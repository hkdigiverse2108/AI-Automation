const router = require('express').Router();
const CallLog = require('../models/CallLog');
const Complaint = require('../models/Complaint');
const LostItem = require('../models/LostItem');
const CallbackRequest = require('../models/CallbackRequest');
const User = require('../models/User');
const Organization = require('../models/Organization');
const notificationService = require('../services/notificationService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

/**
 * Helper: Send real-time notification to all active staff/admins of an organization
 */
async function notifyOrganization(orgId, { type, title, message, link, metadata = {} }) {
  try {
    const staff = await User.find({
      organizationId: orgId,
      isDeleted: { $ne: true },
      isSuspended: false
    }).select('_id');

    for (const member of staff) {
      await notificationService.createNotification({
        userId: member._id,
        organizationId: orgId,
        type,
        title,
        message,
        link,
        metadata
      });
    }
  } catch (err) {
    logger.error('Failed to notify organization staff:', err.message);
  }
}

/**
 * Helper: Broadcast socket event to organization room
 */
function broadcastSocketEvent(req, orgId, type, data) {
  const io = req.app.get('io');
  if (io) {
    io.to(`organization_${orgId}`).emit('telephony_event', { type, data });
    logger.info(`Broadcasted socket event telephony_event [${type}] to organization_${orgId}`);
  }
}

/**
 * POST /api/myoperator/webhook
 * Handles call started & ended events from MyOperator IVR.
 */
router.post('/webhook', async (req, res) => {
  try {
    const orgId = req.query.orgId || req.query.organization_id || req.body.orgId || req.body.organization_id;
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'organization_id query parameter is required for multi-tenant isolation' });
    }

    const {
      session_id,
      from_number,
      to_number,
      duration,
      status, // 'started', 'ended', etc.
      last_intent,
      recording_url
    } = req.body;

    if (!session_id || !from_number) {
      return res.status(400).json({ success: false, error: 'session_id and from_number are required' });
    }

    // Upsert CallLog to handle race conditions and prevent duplicates
    let callLog;
    try {
      callLog = await CallLog.findOneAndUpdate(
        { session_id },
        {
          $set: {
            from_number: from_number.replace(/\D/g, ''),
            to_number: to_number ? to_number.replace(/\D/g, '') : '',
            duration: parseInt(duration) || 0,
            status: status || 'unknown',
            last_intent: last_intent || '',
            recording_url: recording_url || '',
            organization_id: orgId,
            organizationId: orgId, // dual compatibility
            phone: from_number.replace(/\D/g, ''),
            callType: 'incoming',
            timestamp: new Date()
          }
        },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (err) {
      // In case of high concurrency duplicate key error, retry as update
      if (err.code === 11000) {
        callLog = await CallLog.findOneAndUpdate(
          { session_id },
          {
            $set: {
              duration: parseInt(duration) || 0,
              status: status || 'unknown',
              last_intent: last_intent || '',
              recording_url: recording_url || ''
            }
          },
          { new: true }
        );
      } else {
        throw err;
      }
    }

    // Trigger notification and socket only on call started stage to prevent spamming
    if (status === 'started') {
      await notifyOrganization(orgId, {
        type: 'team',
        title: 'Incoming Call 📞',
        message: `Active call started from ${from_number}.`,
        link: '/dashboard/call-logs',
        metadata: { callLogId: callLog._id, sessionId: session_id }
      });
    } else if (status === 'ended') {
      await notifyOrganization(orgId, {
        type: 'team',
        title: 'Call Ended 📞',
        message: `Call from ${from_number} ended. Duration: ${duration}s.`,
        link: '/dashboard/call-logs',
        metadata: { callLogId: callLog._id, sessionId: session_id }
      });
    }

    broadcastSocketEvent(req, orgId, 'call_logged', callLog);

    res.json({ success: true, data: callLog });
  } catch (error) {
    logger.error('MyOperator Webhook Error:', error.stack);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
});

/**
 * POST /api/myoperator/lost-found
 * Automatically creates a LostItem ticket.
 */
router.post('/lost-found', async (req, res) => {
  try {
    const orgId = req.query.orgId || req.query.organization_id || req.body.orgId || req.body.organization_id;
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'organization_id parameter is required' });
    }

    const { name, phone_number, lost_item, date_lost, recording_url } = req.body;
    if (!phone_number || !lost_item) {
      return res.status(400).json({ success: false, error: 'phone_number and lost_item are required' });
    }

    const cleanPhone = phone_number.replace(/\D/g, '');

    // Prevent duplicates within last 3 minutes
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const existing = await LostItem.findOne({
      phone_number: cleanPhone,
      lost_item,
      organization_id: orgId,
      createdAt: { $gte: threeMinutesAgo }
    });

    if (existing) {
      return res.json({ success: true, message: 'Duplicate ticket blocked', data: existing });
    }

    const ticket = await LostItem.create({
      name: name || 'IVR Caller',
      phone_number: cleanPhone,
      lost_item,
      date_lost: date_lost ? new Date(date_lost) : new Date(),
      recording_url: recording_url || '',
      organization_id: orgId,
      status: 'reported'
    });

    await notifyOrganization(orgId, {
      type: 'system',
      title: 'New Lost & Found Report 🔍',
      message: `Lost item "${lost_item}" reported by ${ticket.name} (${phone_number}).`,
      link: '/dashboard/call-logs',
      metadata: { ticketId: ticket._id }
    });

    broadcastSocketEvent(req, orgId, 'lost_item_logged', ticket);

    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    logger.error('MyOperator Lost & Found webhook error:', error.stack);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
});

/**
 * POST /api/myoperator/complaint
 * Automatically creates a Complaint ticket.
 */
router.post('/complaint', async (req, res) => {
  try {
    const orgId = req.query.orgId || req.query.organization_id || req.body.orgId || req.body.organization_id;
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'organization_id parameter is required' });
    }

    const { name, phone_number, complaint, visit_date, recording_url } = req.body;
    if (!phone_number || !complaint) {
      return res.status(400).json({ success: false, error: 'phone_number and complaint details are required' });
    }

    const cleanPhone = phone_number.replace(/\D/g, '');

    // Prevent duplicates within last 3 minutes
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const existing = await Complaint.findOne({
      phone_number: cleanPhone,
      complaint,
      organization_id: orgId,
      createdAt: { $gte: threeMinutesAgo }
    });

    if (existing) {
      return res.json({ success: true, message: 'Duplicate ticket blocked', data: existing });
    }

    const ticket = await Complaint.create({
      name: name || 'IVR Caller',
      phone_number: cleanPhone,
      complaint,
      visit_date: visit_date ? new Date(visit_date) : new Date(),
      recording_url: recording_url || '',
      organization_id: orgId,
      status: 'pending'
    });

    await notifyOrganization(orgId, {
      type: 'system',
      title: 'New Complaint Ticket 🚨',
      message: `New complaint filed by ${ticket.name} (${phone_number}).`,
      link: '/dashboard/call-logs',
      metadata: { ticketId: ticket._id }
    });

    broadcastSocketEvent(req, orgId, 'complaint_logged', ticket);

    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    logger.error('MyOperator Complaint webhook error:', error.stack);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
});

/**
 * POST /api/myoperator/callback
 * Automatically creates a CallbackRequest.
 */
router.post('/callback', async (req, res) => {
  try {
    const orgId = req.query.orgId || req.query.organization_id || req.body.orgId || req.body.organization_id;
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'organization_id parameter is required' });
    }

    const { name, phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ success: false, error: 'phone_number is required' });
    }

    const cleanPhone = phone_number.replace(/\D/g, '');

    // Prevent duplicate callbacks within last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await CallbackRequest.findOne({
      phone_number: cleanPhone,
      organization_id: orgId,
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (existing) {
      return res.json({ success: true, message: 'Duplicate callback request blocked', data: existing });
    }

    const request = await CallbackRequest.create({
      name: name || 'IVR Caller',
      phone_number: cleanPhone,
      organization_id: orgId,
      status: 'pending'
    });

    await notifyOrganization(orgId, {
      type: 'system',
      title: 'New Callback Request 📞',
      message: `${request.name} requested a callback at ${phone_number}.`,
      link: '/dashboard/call-logs',
      metadata: { requestId: request._id }
    });

    broadcastSocketEvent(req, orgId, 'callback_logged', request);

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    logger.error('MyOperator Callback webhook error:', error.stack);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
