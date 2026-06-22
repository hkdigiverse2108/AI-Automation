const router = require('express').Router();
const mongoose = require('mongoose');
const axios = require('axios');
const ParkConfig = require('../models/ParkConfig');
const CallLog = require('../models/CallLog');
const Complaint = require('../models/Complaint');
const LostItem = require('../models/LostItem');
const CallbackRequest = require('../models/CallbackRequest');
const User = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/auth');
const ttsService = require('../services/ttsService');
const notificationService = require('../services/notificationService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

// Protect all admin routes using JWT middleware
router.use(verifyToken);

/**
 * Helper: Notify organization staff
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
 * Helper: Broadcast socket event
 */
function broadcastSocketEvent(req, orgId, type, data) {
  const io = req.app.get('io');
  if (io) {
    io.to(`organization_${orgId}`).emit('telephony_event', { type, data });
  }
}

/**
 * GET /api/admin/park-config
 */
router.get('/park-config', async (req, res) => {
  try {
    const orgId = req.organizationId;
    let config = await ParkConfig.findOne({ organization_id: orgId });
    if (!config) {
      // Create a default initial configuration if it doesn't exist
      config = await ParkConfig.create({
        park_name: 'My Theme Park',
        voice_id: '21m00Tcm4TlvDq8ikWAM',
        ticket_prices: { adult: 500, child: 300, senior: 350 },
        timings: '09:00 AM - 06:00 PM',
        address: '123 Fun Street, Amusement City',
        multilingual: {
          custom_texts: {
            en: 'Welcome to our theme park. Please listen carefully to the menu options.',
            hi: 'हमारे थीम पार्क में आपका स्वागत है। कृपया विकल्पों को ध्यान से सुनें।',
            gu: 'અમારા થીમ પાર્કમાં તમારું સ્વાગત છે. કૃપા કરીને વિકલ્પો ધ્યાનથી સાંભળો.'
          }
        },
        audio_urls: { en: '', hi: '', gu: '' },
        organization_id: orgId,
        created_by: req.user._id
      });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch park configuration', details: error.message });
  }
});

/**
 * PUT /api/admin/park-config
 */
router.put('/park-config', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { park_name, voice_id, ticket_prices, timings, address, custom_texts } = req.body;

    let config = await ParkConfig.findOne({ organization_id: orgId });
    const isNew = !config;

    let previousVoiceId = config ? config.voice_id : '';
    let previousTexts = config ? config.multilingual?.custom_texts : { en: '', hi: '', gu: '' };

    const targetVoiceId = voice_id || '21m00Tcm4TlvDq8ikWAM';
    const targetTexts = {
      en: custom_texts?.en || '',
      hi: custom_texts?.hi || '',
      gu: custom_texts?.gu || ''
    };

    let needsRegen = isNew || previousVoiceId !== targetVoiceId;
    if (!needsRegen) {
      if (previousTexts.en !== targetTexts.en || previousTexts.hi !== targetTexts.hi || previousTexts.gu !== targetTexts.gu) {
        needsRegen = true;
      }
    }

    const audioUrls = config ? { ...config.audio_urls } : { en: '', hi: '', gu: '' };

    if (needsRegen) {
      logger.info(`[TTS Regen Trigger] Regenerating TTS audio files for voice_id: ${targetVoiceId}`);
      try {
        if (targetTexts.en) audioUrls.en = await ttsService.getTTSAudioUrl(targetTexts.en, 'en', targetVoiceId);
        if (targetTexts.hi) audioUrls.hi = await ttsService.getTTSAudioUrl(targetTexts.hi, 'hi', targetVoiceId);
        if (targetTexts.gu) audioUrls.gu = await ttsService.getTTSAudioUrl(targetTexts.gu, 'gu', targetVoiceId);
      } catch (err) {
        logger.error('[TTS Regen Failed] Failed to generate ElevenLabs voice file:', err.message);
      }
    }

    if (isNew) {
      config = await ParkConfig.create({
        park_name,
        voice_id: targetVoiceId,
        ticket_prices: ticket_prices || {},
        timings: timings || '',
        address: address || '',
        multilingual: { custom_texts: targetTexts },
        audio_urls: audioUrls,
        organization_id: orgId,
        created_by: req.user._id
      });
    } else {
      config.park_name = park_name;
      config.voice_id = targetVoiceId;
      config.ticket_prices = ticket_prices || {};
      config.timings = timings || '';
      config.address = address || '';
      config.multilingual = { custom_texts: targetTexts };
      config.audio_urls = audioUrls;
      await config.save();
    }

    await notifyOrganization(orgId, {
      type: 'system',
      title: 'Voice settings updated ⚙️',
      message: 'Park configurations and speech scripts have been updated.',
      link: '/dashboard/call-logs'
    });

    broadcastSocketEvent(req, orgId, 'park_config_updated', config);

    res.json({ success: true, data: config, message: 'Park configuration updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update park configuration', details: error.message });
  }
});

/**
 * GET /api/admin/analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // 1. 7-day call counts
    const callStats = await CallLog.aggregate([
      {
        $match: {
          organization_id: new mongoose.Types.ObjectId(orgId),
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dailyCalls = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = callStats.find(item => item._id === dateStr);
      dailyCalls.push({
        date: dateStr,
        count: found ? found.count : 0
      });
    }

    // 2. Complaint breakdown
    const complaintStats = await Complaint.aggregate([
      { $match: { organization_id: new mongoose.Types.ObjectId(orgId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const complaintBreakdown = { pending: 0, investigating: 0, resolved: 0 };
    complaintStats.forEach(item => {
      if (complaintBreakdown[item._id] !== undefined) {
        complaintBreakdown[item._id] = item.count;
      }
    });

    // 3. Callback queue (Pending callback count)
    const callbackQueue = await CallbackRequest.countDocuments({
      organization_id: orgId,
      status: 'pending'
    });

    // 4. Totals
    const totalCalls = await CallLog.countDocuments({ organization_id: orgId });
    const lostItemsCount = await LostItem.countDocuments({ organization_id: orgId });
    const totalComplaints = await Complaint.countDocuments({ organization_id: orgId });
    const totalCallbacks = await CallbackRequest.countDocuments({ organization_id: orgId });

    res.json({
      success: true,
      data: {
        dailyCalls,
        complaintBreakdown,
        callbackQueue,
        totalCalls,
        lostItemsCount,
        ticketCounts: {
          complaints: totalComplaints,
          lostItems: lostItemsCount,
          callbacks: totalCallbacks
        }
      }
    });
  } catch (error) {
    logger.error('Analytics Fetch Error:', error.stack);
    res.status(500).json({ success: false, error: 'Failed to retrieve analytics', details: error.message });
  }
});

/**
 * POST /api/admin/click-to-call
 */
router.post('/click-to-call', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required to dial outbound call' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const config = await ParkConfig.findOne({ organization_id: orgId });
    const audioUrl = config?.audio_urls?.en || '';

    logger.info(`[OBD Click-to-Call] Dialing phone: ${cleanPhone} for org: ${orgId}`);

    const obdToken = process.env.MYOPERATOR_OBD_TOKEN || 'mock_obd_token';
    const obdCompanyId = process.env.MYOPERATOR_COMPANY_ID || 'mock_company_id';

    // Log the outbound call immediately
    const callLog = await CallLog.create({
      session_id: `obd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from_number: 'OBD_SYSTEM',
      to_number: cleanPhone,
      duration: 0,
      status: 'initiated',
      last_intent: 'Agent Click-to-Call',
      recording_url: '',
      organization_id: orgId,
      organizationId: orgId,
      phone: cleanPhone,
      callType: 'outgoing',
      userId: req.user._id
    });

    let apiError = null;

    if (process.env.MYOPERATOR_OBD_TOKEN) {
      try {
        await axios.post('https://obd-api.myoperator.co/obd-api-v1', {
          token: obdToken,
          company_id: obdCompanyId,
          number: cleanPhone,
          audio_url: audioUrl
        }, { timeout: 10000 });
      } catch (err) {
        apiError = err.message;
        logger.error(`[OBD API Failure] Failed to invoke MyOperator OBD: ${err.message}`);
        callLog.status = 'failed';
        await callLog.save();
      }
    } else {
      logger.warn('[OBD MOCK] No OBD Token defined, mocking successful outbound dial.');
      callLog.status = 'completed';
      callLog.duration = Math.floor(Math.random() * 60) + 10;
      await callLog.save();
    }

    if (apiError) {
      return res.status(502).json({ success: false, error: 'MyOperator OBD server failed to dispatch call', details: apiError });
    }

    await notifyOrganization(orgId, {
      type: 'team',
      title: 'OBD Call Initiated 📡',
      message: `Outbound click-to-call initiated for ${cleanPhone} by ${req.user.name}.`,
      link: '/dashboard/call-logs'
    });

    broadcastSocketEvent(req, orgId, 'call_logged', callLog);

    res.json({ success: true, data: callLog, message: 'Click-to-call dispatched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Click-to-call trigger failed', details: error.message });
  }
});

/**
 * GET /api/admin/users - List staff members
 */
router.get('/users', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const staff = await User.find({
      organizationId: orgId,
      isDeleted: { $ne: true }
    }).select('name email role isSuspended isEmailVerified createdAt lastSeenAt').sort('-createdAt').lean();

    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch staff members' });
  }
});

/**
 * POST /api/admin/users - Create staff member
 */
router.post('/users', requireRole('superadmin', 'owner', 'admin'), async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Missing name, email, password, or role' });
    }

    if (!['admin', 'agent'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Supported staff roles are: admin, agent' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email address is already in use' });
    }

    const Organization = require('../models/Organization');
    const org = await Organization.findById(orgId);
    if (org && role === 'agent') {
      const activeAgents = await User.countDocuments({
        organizationId: org._id,
        role: 'agent',
        isDeleted: { $ne: true }
      });
      if (activeAgents >= org.maxTelecallers) {
        return res.status(400).json({ success: false, error: `Maximum telecallers limit of ${org.maxTelecallers} reached under your current subscription.` });
      }
    }

    const passwordHash = await User.hashPassword(password);
    const staffUser = await User.create({
      name,
      email,
      passwordHash,
      role,
      ownerId: req.userId,
      organizationId: orgId,
      isEmailVerified: true,
      status: 'active',
      createdByAdmin: req.user._id
    });

    await notifyOrganization(orgId, {
      type: 'team',
      title: 'Staff account created 👤',
      message: `New ${role} account "${name}" has been created.`,
      link: '/dashboard/call-logs'
    });

    broadcastSocketEvent(req, orgId, 'staff_updated', staffUser.toSafeObject());

    res.status(201).json({ success: true, data: staffUser.toSafeObject(), message: 'Staff member created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create staff member', details: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id - Delete staff member
 */
router.delete('/users/:id', requireRole('superadmin', 'owner', 'admin'), async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot remove your own account' });
    }

    const staffUser = await User.findOne({ _id: id, organizationId: orgId });
    if (!staffUser) {
      return res.status(404).json({ success: false, error: 'Staff member not found in your organization' });
    }

    const Conversation = require('../models/Conversation');
    const RefreshToken = require('../models/RefreshToken');
    const AssignmentRule = require('../models/AssignmentRule');

    // Clean relations
    await Conversation.updateMany(
      { $or: [{ assignedAgent: staffUser._id }, { assigned_agent_id: staffUser._id }] },
      { $unset: { assignedAgent: 1, assigned_agent_id: 1 } }
    );
    await AssignmentRule.deleteMany({ agentId: staffUser._id });
    await RefreshToken.deleteMany({ userId: staffUser._id });
    await User.deleteOne({ _id: staffUser._id });

    await notifyOrganization(orgId, {
      type: 'team',
      title: 'Staff account removed 👤',
      message: `Staff member "${staffUser.name}" has been removed.`,
      link: '/dashboard/call-logs'
    });

    broadcastSocketEvent(req, orgId, 'staff_updated', { _id: id, isDeleted: true });

    res.json({ success: true, message: 'Staff member removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove staff member' });
  }
});

// ==========================================
// CENTRALIZED CRM TICKET MANAGEMENT ENDPOINTS
// ==========================================

/**
 * GET /api/admin/complaints
 */
router.get('/complaints', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { page = 1, limit = 20, search, status } = req.query;
    const query = { organization_id: orgId };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { phone_number: new RegExp(search, 'i') },
        { complaint: new RegExp(search, 'i') }
      ];
    }

    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Complaint.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        complaints,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch complaints' });
  }
});

/**
 * PUT /api/admin/complaints/:id
 */
router.put('/complaints/:id', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { status } = req.body;

    if (!['pending', 'investigating', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid complaint status' });
    }

    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, organization_id: orgId },
      { $set: { status } },
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint ticket not found' });
    }

    broadcastSocketEvent(req, orgId, 'complaint_logged', complaint);

    res.json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update complaint status' });
  }
});

/**
 * GET /api/admin/lost-items
 */
router.get('/lost-items', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { page = 1, limit = 20, search, status } = req.query;
    const query = { organization_id: orgId };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { phone_number: new RegExp(search, 'i') },
        { lost_item: new RegExp(search, 'i') }
      ];
    }

    const [lostItems, total] = await Promise.all([
      LostItem.find(query)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      LostItem.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        lostItems,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch lost items' });
  }
});

/**
 * PUT /api/admin/lost-items/:id
 */
router.put('/lost-items/:id', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { status } = req.body;

    if (!['reported', 'found'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid lost item status' });
    }

    const lostItem = await LostItem.findOneAndUpdate(
      { _id: req.params.id, organization_id: orgId },
      { $set: { status } },
      { new: true }
    );

    if (!lostItem) {
      return res.status(404).json({ success: false, error: 'Lost & found item not found' });
    }

    broadcastSocketEvent(req, orgId, 'lost_item_logged', lostItem);

    res.json({ success: true, data: lostItem });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update lost item status' });
  }
});

/**
 * GET /api/admin/callbacks
 */
router.get('/callbacks', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { page = 1, limit = 20, search, status } = req.query;
    const query = { organization_id: orgId };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { phone_number: new RegExp(search, 'i') }
      ];
    }

    const [callbacks, total] = await Promise.all([
      CallbackRequest.find(query)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      CallbackRequest.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        callbacks,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch callbacks' });
  }
});

/**
 * PUT /api/admin/callbacks/:id
 */
router.put('/callbacks/:id', async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { status } = req.body;

    if (!['pending', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid callback status' });
    }

    const callback = await CallbackRequest.findOneAndUpdate(
      { _id: req.params.id, organization_id: orgId },
      { $set: { status } },
      { new: true }
    );

    if (!callback) {
      return res.status(404).json({ success: false, error: 'Callback request not found' });
    }

    broadcastSocketEvent(req, orgId, 'callback_logged', callback);

    res.json({ success: true, data: callback });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update callback status' });
  }
});

module.exports = router;
