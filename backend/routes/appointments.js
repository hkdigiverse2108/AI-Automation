const router = require('express').Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Contact = require('../models/Contact');
const User = require('../models/User');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const { createNotification } = require('../services/notificationService');
const {
  processGoogleCalendarEvent,
  sendAppointmentConfirmedNotification,
  sendAppointmentReminderNotification,
  sendAppointmentRescheduledNotification,
  sendAppointmentCancelledNotification,
  sendAppointmentThankYouNotification,
  getWhatsAppCredentials,
  sanitizePhoneNumber,
  GOOGLE_CALENDAR_ID,
  BOOKING_URL,
  DEFAULT_SUBJECT,
  DEFAULT_CANCEL_REASON
} = require('../services/appointmentNotificationService');

/* ==========================================================================
   PUBLIC WEBHOOK & TESTING ENDPOINTS (No JWT required for external triggers)
   ========================================================================== */

/**
 * GET /appointments/config-status
 * Check Google Calendar integration & WhatsApp template status
 */
router.get('/config-status', async (req, res) => {
  try {
    let waInfo = null;
    try {
      const wa = await getWhatsAppCredentials();
      waInfo = {
        phoneNumber: wa.phoneNumber,
        phoneNumberId: wa.phoneNumberId,
        displayName: wa.displayName,
        wabaId: wa.wabaId
      };
    } catch (e) {
      waInfo = { error: e.message };
    }

    const totalCount = await Appointment.countDocuments();
    const confirmedCount = await Appointment.countDocuments({ status: 'confirmed' });
    const cancelledCount = await Appointment.countDocuments({ status: 'cancelled' });

    res.json({
      success: true,
      data: {
        calendar: {
          calendarId: GOOGLE_CALENDAR_ID,
          bookingUrl: BOOKING_URL,
          reminderWindowMinutes: 120, // 2 hours
          defaultSubject: DEFAULT_SUBJECT,
          defaultCancelReason: DEFAULT_CANCEL_REASON,
        },
        whatsApp: waInfo,
        stats: {
          total: totalCount,
          confirmed: confirmedCount,
          cancelled: cancelledCount,
        },
        templates: {
          confirmed: 'appointment_confirmed',
          reminder: 'appointment_reminder',
          rescheduled: 'appointment_rescheduled',
          cancelled: 'appointment_cancelled'
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /appointments/google-webhook
 * Ingests events from Google Calendar Apps Script or Webhook
 */
router.post('/google-webhook', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: 'Empty payload received' });
    }

    const result = await processGoogleCalendarEvent(payload);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process Google Calendar webhook', details: error.message });
  }
});

/**
 * POST /appointments/test-booking
 * Immediate test endpoint to verify WhatsApp templates directly on any phone number!
 * Body: { phone, name, action: 'created'|'reminder'|'rescheduled'|'cancelled'|'thankyou', subject, scheduledAt, reason }
 */
router.post('/test-booking', async (req, res) => {
  try {
    const { phone, name, action = 'created', subject, scheduledAt, reason } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'phone is required for testing' });
    }

    const clientPhone = sanitizePhoneNumber(phone);
    const clientName = name || 'Test User';
    const appointmentDate = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    const testAppt = new Appointment({
      googleEventId: `test_${Date.now()}`,
      title: subject || DEFAULT_SUBJECT,
      clientName,
      clientPhone,
      scheduledAt: appointmentDate,
      duration: 30,
      reminderTime: 120,
      status: action === 'cancelled' ? 'cancelled' : 'confirmed',
      cancellationReason: reason || DEFAULT_CANCEL_REASON,
    });

    let notifResult = null;
    switch (action.toLowerCase()) {
      case 'created':
      case 'confirmed':
        notifResult = await sendAppointmentConfirmedNotification(testAppt);
        break;
      case 'reminder':
        notifResult = await sendAppointmentReminderNotification(testAppt);
        break;
      case 'rescheduled':
        notifResult = await sendAppointmentRescheduledNotification(testAppt);
        break;
      case 'cancelled':
        notifResult = await sendAppointmentCancelledNotification(testAppt, reason);
        break;
      case 'thankyou':
        notifResult = await sendAppointmentThankYouNotification(testAppt);
        break;
      default:
        return res.status(400).json({ success: false, error: `Invalid action '${action}'. Allowed: created, reminder, rescheduled, cancelled, thankyou` });
    }

    res.json({
      success: true,
      action,
      phone: clientPhone,
      clientName,
      scheduledAt: appointmentDate,
      notificationResult: notifResult,
      message: `Test ${action} notification executed successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to execute test booking', details: error.message });
  }
});


/* ==========================================================================
   AUTHENTICATED CRM DASHBOARD ROUTES (JWT Required)
   ========================================================================== */

router.use(verifyToken);

// GET /appointments — List appointments for CRM dashboard
router.get('/', async (req, res) => {
  try {
    const { status, contactId, assignedTo, page = 1, limit = 20 } = req.query;
    const query = {};
    if (req.organizationId) query.organizationId = req.organizationId;

    if (status) query.status = status;
    if (contactId && mongoose.Types.ObjectId.isValid(contactId)) query.contactId = contactId;
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) query.assignedTo = assignedTo;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('contactId', 'name phone email')
        .populate('assignedTo', 'name email role avatar')
        .populate('createdBy', 'name email')
        .lean(),
      Appointment.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        appointments,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch appointments', details: error.message });
  }
});

// POST /appointments — Create manual appointment from CRM
router.post('/', async (req, res) => {
  try {
    const { title, description, contactId, assignedTo, scheduledAt, duration, reminderTime, clientPhone, clientName } = req.body;
    if (!title || !scheduledAt) {
      return res.status(400).json({ success: false, error: 'Title and scheduledAt are required' });
    }

    let contact = null;
    if (contactId && mongoose.Types.ObjectId.isValid(contactId)) {
      contact = await Contact.findById(contactId);
    }

    const appointment = await Appointment.create({
      organizationId: req.organizationId,
      title,
      description: description || '',
      contactId: contact?._id,
      assignedTo: assignedTo || req.user._id,
      scheduledAt: new Date(scheduledAt),
      duration: duration || 30,
      reminderTime: reminderTime || 120, // 2 hours
      status: 'confirmed',
      clientName: clientName || contact?.name || 'Valued Client',
      clientPhone: sanitizePhoneNumber(clientPhone || contact?.phone),
      createdBy: req.user._id
    });

    // Send WhatsApp confirmation if phone number exists
    if (appointment.clientPhone) {
      await sendAppointmentConfirmedNotification(appointment);
    }

    // Notify assignee
    if (assignedTo && assignedTo.toString() !== req.user._id.toString()) {
      await createNotification({
        userId: assignedTo,
        organizationId: req.organizationId,
        type: 'appointment',
        title: 'New Appointment Scheduled 📅',
        message: `You have a new appointment: "${title}" with ${appointment.clientName}.`,
        link: '/dashboard/contacts',
        metadata: { appointmentId: appointment._id }
      });
    }

    res.status(201).json({ success: true, data: { appointment }, message: 'Appointment created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create appointment', details: error.message });
  }
});

// PUT /appointments/:id — Update appointment
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { title, description, scheduledAt, duration, status, reminderTime, cancellationReason } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    const oldStatus = appointment.status;
    const oldTime = appointment.scheduledAt ? new Date(appointment.scheduledAt).getTime() : 0;

    if (title !== undefined) appointment.title = title;
    if (description !== undefined) appointment.description = description;
    if (duration !== undefined) appointment.duration = duration;
    if (reminderTime !== undefined) appointment.reminderTime = reminderTime;
    if (cancellationReason !== undefined) appointment.cancellationReason = cancellationReason;

    let timeChanged = false;
    if (scheduledAt !== undefined) {
      const newTime = new Date(scheduledAt).getTime();
      timeChanged = Math.abs(newTime - oldTime) > 60 * 1000;
      appointment.scheduledAt = new Date(scheduledAt);
      appointment.reminded = false; // Reset reminder on rescheduled
    }

    if (status !== undefined) {
      const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      appointment.status = status;
    }

    await appointment.save();

    // Trigger WhatsApp notification on status or time changes
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      await sendAppointmentCancelledNotification(appointment, cancellationReason);
    } else if (timeChanged && appointment.status !== 'cancelled') {
      await sendAppointmentRescheduledNotification(appointment);
    }

    res.json({ success: true, data: { appointment }, message: 'Appointment updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update appointment', details: error.message });
  }
});

// DELETE /appointments/:id — Delete appointment
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    // If active appointment is deleted, trigger cancellation message
    if (appointment.status !== 'cancelled' && appointment.clientPhone) {
      await sendAppointmentCancelledNotification(appointment, 'Appointment removed from schedule');
    }

    await Appointment.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Appointment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete appointment', details: error.message });
  }
});

module.exports = router;
