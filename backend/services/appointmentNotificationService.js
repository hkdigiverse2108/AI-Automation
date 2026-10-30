const winston = require('winston');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const Appointment = require('../models/Appointment');
const Contact = require('../models/Contact');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { decryptField } = require('./encryption');
const { sendTemplateMessage, sendTextMessage } = require('./whatsapp');
const { createNotification } = require('./notificationService');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const DEFAULT_SUBJECT = 'Business meeting with HK DigiVerse LLP';
const DEFAULT_CANCEL_REASON = 'Due to some important work';
const GOOGLE_CALENDAR_ID = 'hrmangukiya3494@gmail.com';
const BOOKING_URL = 'https://calendar.app.google/ZvhrmRV1dnYSL4XC8';

// Synchronous In-Memory Lock to block concurrent duplicate requests (Debounce)
const activeProcessingLock = new Map();

/**
 * Retrieve active WhatsApp credentials with approved appointment templates
 */
async function getWhatsAppCredentials() {
  const preferredPhoneId = process.env.APPOINTMENT_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID || '1160367790492107';
  let waAccount = await WhatsAppAccount.findOne({ phoneNumberId: preferredPhoneId });

  if (!waAccount) {
    waAccount = await WhatsAppAccount.findOne({ isActive: true });
  }

  if (!waAccount) {
    throw new Error('No active WhatsApp account found in system.');
  }

  let token = decryptField(waAccount.accessToken);
  if (!token && process.env.META_ACCESS_TOKEN && !process.env.META_ACCESS_TOKEN.startsWith('your_')) {
    token = process.env.META_ACCESS_TOKEN;
  }

  return {
    phoneNumberId: waAccount.phoneNumberId,
    token,
    wabaId: waAccount.wabaId,
    displayName: waAccount.displayName,
    phoneNumber: waAccount.phoneNumber
  };
}

/**
 * Sanitize recipient phone number for WhatsApp Meta API (e.g. 919876543210)
 */
function sanitizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = `91${cleaned.substring(1)}`;
  }
  return cleaned;
}

/**
 * Format date in IST (e.g. "Fri 30 Oct 2026")
 */
function formatAppointmentDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  const formatted = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  return formatted.replace(/,/g, '');
}

/**
 * Format time in IST (e.g. "04:00 PM IST")
 */
function formatAppointmentTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  const timeStr = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return `${timeStr.toUpperCase()} IST`;
}

/**
 * Parse phone number from description or notes if not provided directly
 */
function extractPhoneFromText(text) {
  if (!text) return '';
  
  // Clean HTML entities & tags
  const clean = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, ' ');

  // Pattern 1: Explicit labels like "Phone number: +919876543210" or "Mobile: 9876543210"
  const labelMatch = clean.match(/(?:phone(?:\s*number)?|mobile|whatsapp|contact|tel)[\s:*-]+([+0-9\s-]{10,16})/i);
  if (labelMatch && labelMatch[1]) {
    const cleaned = sanitizePhoneNumber(labelMatch[1]);
    if (cleaned.length >= 10) return cleaned;
  }

  // Pattern 2: Generic Indian phone numbers (+91 or 10-digit starting with 6-9)
  const phoneMatch = clean.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  if (phoneMatch && phoneMatch[0]) {
    const cleaned = sanitizePhoneNumber(phoneMatch[0]);
    if (cleaned.length >= 10) return cleaned;
  }

  return '';
}

/**
 * Parse client name from description, summary or attendee list
 */
function extractNameFromPayload(payload) {
  if (payload.clientName && payload.clientName.trim()) {
    return payload.clientName.trim();
  }

  // Check description for "Booked by" with HTML tags like <b>Booked by</b>\nPratvi Jikadra
  if (payload.description) {
    const rawDesc = payload.description
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<[^>]+>/g, '\n');
    const bookedByMatch = rawDesc.match(/Booked by\s*[:\s]*([^\(\n\r<]+)/i);
    if (bookedByMatch && bookedByMatch[1] && bookedByMatch[1].trim()) {
      return bookedByMatch[1].trim();
    }
  }

  // Check event summary (e.g. "Let’s Talk – Het Mangukiya (Pratvi Jikadra)" -> extract inside parentheses)
  if (payload.summary) {
    const parenMatch = payload.summary.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1] && parenMatch[1].trim()) {
      return parenMatch[1].trim();
    }
    let clean = payload.summary.replace(/Het\s+Mangukiya\s+(?:and|&)\s+/i, '');
    clean = clean.replace(/Let[’']s\s+Talk\s*[-–]?\s*/i, '');
    clean = clean.replace(/Business meeting with HK DigiVerse LLP/i, '');
    clean = clean.trim();
    if (clean.length > 1 && clean.length < 50) return clean;
  }

  // Check attendees list for non-host attendee
  if (Array.isArray(payload.attendees)) {
    const guest = payload.attendees.find(
      a => a.email && !a.email.toLowerCase().includes('hrmangukiya3494') && (a.name || a.displayName)
    );
    if (guest && (guest.name || guest.displayName)) {
      return (guest.name || guest.displayName).trim();
    }
  }

  return 'Valued Client';
}

/**
 * Send Appointment Confirmed WhatsApp Template
 * Template: appointment_confirmed
 * {{1}} = Client Name
 * {{2}} = Subject
 * {{3}} = Date
 * {{4}} = Time
 */
async function sendAppointmentConfirmedNotification(appointment) {
  try {
    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(appointment.clientPhone);

    if (!recipient) {
      logger.warn(`[AppointmentNotification] No valid phone number for appointment ${appointment._id}`);
      return { success: false, error: 'No valid phone number' };
    }

    const clientName = appointment.clientName || 'Valued Client';
    const subject = appointment.title || DEFAULT_SUBJECT;
    const formattedDate = formatAppointmentDate(appointment.scheduledAt);
    const formattedTime = formatAppointmentTime(appointment.scheduledAt);

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: clientName },
          { type: 'text', text: subject },
          { type: 'text', text: formattedDate },
          { type: 'text', text: formattedTime },
        ],
      },
    ];

    logger.info(`[AppointmentNotification] Sending appointment_confirmed to ${recipient} for appointment ${appointment._id}`);
    const result = await sendTemplateMessage(phoneNumberId, token, recipient, 'appointment_confirmed', 'en', components);

    appointment.notifications = appointment.notifications || {};
    if (result.success) {
      appointment.notifications.confirmed = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      appointment.status = 'confirmed';
      await appointment.save();
      logger.info(`[AppointmentNotification] Confirmed notification sent successfully to ${recipient}`);
    } else {
      appointment.notifications.confirmed = {
        sent: false,
        error: result.error || 'Failed to send template',
      };
      await appointment.save();
      logger.error(`[AppointmentNotification] Failed to send confirmed template to ${recipient}: ${result.error}`);
    }

    return result;
  } catch (err) {
    logger.error(`[AppointmentNotification] Error sending appointment_confirmed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send Appointment Reminder WhatsApp Template (2 hours before meeting)
 * Template: appointment_reminder
 * {{1}} = Client Name
 * {{2}} = Subject
 * {{3}} = Date
 * {{4}} = Time
 */
async function sendAppointmentReminderNotification(appointment) {
  try {
    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(appointment.clientPhone);

    if (!recipient) {
      return { success: false, error: 'No valid phone number' };
    }

    const clientName = appointment.clientName || 'Valued Client';
    const subject = appointment.title || DEFAULT_SUBJECT;
    const formattedDate = formatAppointmentDate(appointment.scheduledAt);
    const formattedTime = formatAppointmentTime(appointment.scheduledAt);

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: clientName },
          { type: 'text', text: subject },
          { type: 'text', text: formattedDate },
          { type: 'text', text: formattedTime },
        ],
      },
    ];

    logger.info(`[AppointmentNotification] Sending appointment_reminder to ${recipient} for appointment ${appointment._id}`);
    const result = await sendTemplateMessage(phoneNumberId, token, recipient, 'appointment_reminder', 'en', components);

    appointment.notifications = appointment.notifications || {};
    if (result.success) {
      appointment.notifications.reminder = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      appointment.reminded = true;
      await appointment.save();
      logger.info(`[AppointmentNotification] Reminder sent successfully to ${recipient}`);
    } else {
      appointment.notifications.reminder = {
        sent: false,
        error: result.error || 'Failed to send template',
      };
      await appointment.save();
      logger.error(`[AppointmentNotification] Failed to send reminder to ${recipient}: ${result.error}`);
    }

    return result;
  } catch (err) {
    logger.error(`[AppointmentNotification] Error sending appointment_reminder: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send Appointment Rescheduled WhatsApp Template
 * Template: appointment_rescheduled
 * {{1}} = Client Name
 * {{2}} = Subject
 * {{3}} = New Date
 * {{4}} = New Time
 */
async function sendAppointmentRescheduledNotification(appointment) {
  try {
    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(appointment.clientPhone);

    if (!recipient) {
      return { success: false, error: 'No valid phone number' };
    }

    const clientName = appointment.clientName || 'Valued Client';
    const subject = appointment.title || DEFAULT_SUBJECT;
    const formattedDate = formatAppointmentDate(appointment.scheduledAt);
    const formattedTime = formatAppointmentTime(appointment.scheduledAt);

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: clientName },
          { type: 'text', text: subject },
          { type: 'text', text: formattedDate },
          { type: 'text', text: formattedTime },
        ],
      },
    ];

    logger.info(`[AppointmentNotification] Sending appointment_rescheduled to ${recipient} for appointment ${appointment._id}`);
    const result = await sendTemplateMessage(phoneNumberId, token, recipient, 'appointment_rescheduled', 'en', components);

    appointment.notifications = appointment.notifications || {};
    if (result.success) {
      appointment.notifications.rescheduled = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      appointment.reminded = false; // Reset so reminder can trigger for the new time!
      await appointment.save();
      logger.info(`[AppointmentNotification] Rescheduled template sent successfully to ${recipient}`);
    } else {
      appointment.notifications.rescheduled = {
        sent: false,
        error: result.error || 'Failed to send template',
      };
      await appointment.save();
      logger.warn(`[AppointmentNotification] Rescheduled template queued/failed for ${recipient}: ${result.error}`);
    }

    return result;
  } catch (err) {
    logger.error(`[AppointmentNotification] Error sending appointment_rescheduled: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send Appointment Cancelled WhatsApp Template
 * Template: appointment_cancelled
 * {{1}} = Client Name
 * {{2}} = Subject
 * {{3}} = Date
 * {{4}} = Time
 * {{5}} = Reason
 */
async function sendAppointmentCancelledNotification(appointment, reason) {
  try {
    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(appointment.clientPhone);

    if (!recipient) {
      return { success: false, error: 'No valid phone number' };
    }

    const clientName = appointment.clientName || 'Valued Client';
    const subject = appointment.title || DEFAULT_SUBJECT;
    const formattedDate = formatAppointmentDate(appointment.scheduledAt);
    const formattedTime = formatAppointmentTime(appointment.scheduledAt);
    const cancelReason = reason || appointment.cancellationReason || DEFAULT_CANCEL_REASON;

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: clientName },
          { type: 'text', text: subject },
          { type: 'text', text: formattedDate },
          { type: 'text', text: formattedTime },
          { type: 'text', text: cancelReason },
        ],
      },
    ];

    logger.info(`[AppointmentNotification] Sending appointment_cancelled to ${recipient} for appointment ${appointment._id}`);
    const result = await sendTemplateMessage(phoneNumberId, token, recipient, 'appointment_cancelled', 'en', components);

    appointment.notifications = appointment.notifications || {};
    appointment.status = 'cancelled';
    appointment.cancellationReason = cancelReason;

    if (result.success) {
      appointment.notifications.cancelled = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      await appointment.save();
      logger.info(`[AppointmentNotification] Cancelled template sent successfully to ${recipient}`);
    } else {
      appointment.notifications.cancelled = {
        sent: false,
        error: result.error || 'Failed to send template',
      };
      await appointment.save();
      logger.warn(`[AppointmentNotification] Cancelled template queued/failed for ${recipient}: ${result.error}`);
    }

    return result;
  } catch (err) {
    logger.error(`[AppointmentNotification] Error sending appointment_cancelled: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send Post-Meeting Thank You / Follow-up Message
 */
async function sendAppointmentThankYouNotification(appointment) {
  try {
    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(appointment.clientPhone);

    if (!recipient) {
      return { success: false, error: 'No valid phone number' };
    }

    const clientName = appointment.clientName || 'Valued Client';
    const messageText = `Hello ${clientName},\n\nThank you for connecting with HK DigiVerse LLP today! 🤝\n\nIf you have any further questions or if there is anything else we can assist you with, please feel free to reply directly to this message.\n\nWarm regards,\nHK DigiVerse LLP`;

    logger.info(`[AppointmentNotification] Sending Thank You message to ${recipient} for appointment ${appointment._id}`);
    const result = await sendTextMessage(phoneNumberId, token, recipient, messageText);

    appointment.notifications = appointment.notifications || {};
    appointment.status = 'completed';

    if (result.success) {
      appointment.notifications.thankYou = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      await appointment.save();
      logger.info(`[AppointmentNotification] Thank you message sent successfully to ${recipient}`);
    } else {
      appointment.notifications.thankYou = {
        sent: false,
        error: result.error || 'Failed to send thank you message',
      };
      await appointment.save();
      logger.warn(`[AppointmentNotification] Thank you message could not be delivered to ${recipient}: ${result.error}`);
    }

    return result;
  } catch (err) {
    logger.error(`[AppointmentNotification] Error sending thank you: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Helper to ensure a Contact exists in DB for this phone number
 */
async function ensureContact(clientName, clientPhone, clientEmail, organizationId, userId) {
  try {
    const phone = sanitizePhoneNumber(clientPhone);
    if (!phone) return null;

    let contact = await Contact.findOne({ phone });
    if (!contact) {
      contact = await Contact.create({
        name: clientName || 'Customer',
        phone,
        email: clientEmail || '',
        userId: userId,
        organizationId: organizationId,
        source: 'api',
      });
    } else if (clientName && (!contact.name || contact.name === 'Customer')) {
      contact.name = clientName;
      if (clientEmail && !contact.email) contact.email = clientEmail;
      await contact.save();
    }
    return contact;
  } catch (err) {
    logger.warn(`[AppointmentNotification] Error in ensureContact: ${err.message}`);
    return null;
  }
}

/**
 * Core processor for Google Calendar Events (Webhook or Apps Script payload)
 */
async function processGoogleCalendarEvent(payload) {
  try {
    const googleEventId = payload.eventId || payload.id;
    const action = (payload.action || 'created').toLowerCase();
    const scheduledAtRaw = payload.startTime || payload.start?.dateTime || payload.scheduledAt;

    // 1. Anti-Duplicate Lock (Debounce 20 seconds per eventId + action)
    if (googleEventId) {
      const lockKey = `${googleEventId}_${action}_${scheduledAtRaw || ''}`;
      const lastRun = activeProcessingLock.get(lockKey);
      if (lastRun && (Date.now() - lastRun) < 20000) {
        logger.warn(`[AppointmentNotification] Anti-Duplicate blocked repeated signal for ${lockKey}`);
        return { success: true, duplicate: true, message: 'Duplicate event ignored within debounce window' };
      }
      activeProcessingLock.set(lockKey, Date.now());

      // Periodic cleanup of lock map
      if (activeProcessingLock.size > 2000) {
        const threshold = Date.now() - 60000;
        for (const [key, ts] of activeProcessingLock.entries()) {
          if (ts < threshold) activeProcessingLock.delete(key);
        }
      }
    }

    logger.info(`[AppointmentNotification] Processing event: ${JSON.stringify({
      action,
      eventId: googleEventId,
      summary: payload.summary || payload.title,
      startTime: scheduledAtRaw
    })}`);

    if (!scheduledAtRaw && action !== 'cancelled') {
      return { success: false, error: 'Start time is required for appointment' };
    }

    const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : new Date();

    // Parse details
    const clientPhone = payload.clientPhone || extractPhoneFromText(payload.description || '');
    const clientName = extractNameFromPayload(payload);
    const clientEmail = payload.clientEmail || (payload.attendees?.find(a => !a.email?.includes('hrmangukiya3494'))?.email) || '';
    
    // Clean subject (default to professional business meeting)
    let subject = DEFAULT_SUBJECT;
    if (payload.subject && payload.subject !== DEFAULT_SUBJECT) {
      subject = payload.subject;
    }

    const cancelReason = payload.reason || payload.cancellationReason || DEFAULT_CANCEL_REASON;
    const duration = payload.duration || 30;

    // Get default admin user and organization
    let defaultUser = await User.findOne({ email: 'hrmangukiya3494@gmail.com' });
    if (!defaultUser) {
      defaultUser = await User.findOne({ role: { $in: ['admin', 'superadmin'] } });
    }

    let defaultOrg = null;
    if (defaultUser?.organizationId) {
      defaultOrg = await Organization.findById(defaultUser.organizationId);
    }
    if (!defaultOrg) {
      defaultOrg = await Organization.findOne({ name: /HariKrushn/i }) || await Organization.findOne();
    }

    const orgId = defaultOrg?._id;
    const userId = defaultUser?._id;

    // Ensure Contact exists
    const contact = await ensureContact(clientName, clientPhone, clientEmail, orgId, userId);

    // Look for existing appointment by googleEventId or phone + scheduledAt
    let appointment = null;
    if (googleEventId) {
      appointment = await Appointment.findOne({ googleEventId });
    }
    if (!appointment && clientPhone && scheduledAtRaw) {
      // Check if same phone has an appointment within 1 hour window
      const startWindow = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
      const endWindow = new Date(scheduledAt.getTime() + 60 * 60 * 1000);
      appointment = await Appointment.findOne({
        clientPhone: sanitizePhoneNumber(clientPhone),
        scheduledAt: { $gte: startWindow, $lte: endWindow },
        status: { $ne: 'cancelled' }
      });
    }

    // ACTION: CANCELLED
    if (action === 'cancelled' || action === 'deleted') {
      if (appointment) {
        if (appointment.status === 'cancelled') {
          return { success: true, message: 'Appointment was already cancelled' };
        }
        appointment.status = 'cancelled';
        appointment.cancellationReason = cancelReason;
        await appointment.save();

        const notifResult = await sendAppointmentCancelledNotification(appointment, cancelReason);
        return {
          success: true,
          action: 'cancelled',
          appointmentId: appointment._id,
          notification: notifResult,
          message: 'Appointment marked as cancelled and notification sent'
        };
      } else {
        // Create cancelled record for audit
        const cancelledAppt = await Appointment.create({
          googleEventId,
          googleCalendarId: GOOGLE_CALENDAR_ID,
          bookingUrl: BOOKING_URL,
          title: subject,
          clientName,
          clientPhone: sanitizePhoneNumber(clientPhone),
          clientEmail,
          scheduledAt,
          duration,
          status: 'cancelled',
          cancellationReason: cancelReason,
          organizationId: orgId,
          contactId: contact?._id,
          assignedTo: userId,
          createdBy: userId,
        });

        const notifResult = await sendAppointmentCancelledNotification(cancelledAppt, cancelReason);
        return {
          success: true,
          action: 'cancelled',
          appointmentId: cancelledAppt._id,
          notification: notifResult,
          message: 'Cancelled appointment created and notification sent'
        };
      }
    }

    // ACTION: RESCHEDULED / UPDATED
    if (appointment) {
      const oldTime = appointment.scheduledAt ? new Date(appointment.scheduledAt).getTime() : 0;
      const newTime = scheduledAt.getTime();
      const isTimeChanged = Math.abs(newTime - oldTime) > 60 * 1000; // changed by more than 1 minute

      appointment.scheduledAt = scheduledAt;
      appointment.title = subject;
      appointment.duration = duration;
      if (clientName && clientName !== 'Valued Client') appointment.clientName = clientName;
      if (clientPhone) appointment.clientPhone = sanitizePhoneNumber(clientPhone);
      if (clientEmail) appointment.clientEmail = clientEmail;
      if (payload.meetingLink) appointment.meetingLink = payload.meetingLink;

      if (isTimeChanged) {
        logger.info(`[AppointmentNotification] Appointment ${appointment._id} rescheduled from ${new Date(oldTime).toISOString()} to ${scheduledAt.toISOString()}`);
        appointment.reminded = false; // Reset reminder for the new time!
        appointment.status = 'confirmed';
        await appointment.save();

        const notifResult = await sendAppointmentRescheduledNotification(appointment);
        return {
          success: true,
          action: 'rescheduled',
          appointmentId: appointment._id,
          notification: notifResult,
          message: 'Appointment rescheduled and notification sent'
        };
      } else {
        await appointment.save();
        return {
          success: true,
          action: 'updated',
          appointmentId: appointment._id,
          message: 'Appointment details updated'
        };
      }
    }

    // ACTION: NEW APPOINTMENT (CREATED)
    // Double check: If appointment with this googleEventId already exists, don't create duplicate
    if (googleEventId) {
      const existing = await Appointment.findOne({ googleEventId });
      if (existing) {
        logger.info(`[AppointmentNotification] Duplicate creation prevented for event ${googleEventId}`);
        return { success: true, message: 'Appointment already exists' };
      }
    }

    const newAppointment = await Appointment.create({
      googleEventId: googleEventId || `appt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      googleCalendarId: GOOGLE_CALENDAR_ID,
      bookingUrl: BOOKING_URL,
      title: subject,
      description: payload.description || '',
      clientName,
      clientPhone: sanitizePhoneNumber(clientPhone),
      clientEmail,
      meetingLink: payload.meetingLink || payload.hangoutLink || '',
      scheduledAt,
      duration,
      reminderTime: 120, // 2 hours = 120 minutes
      reminded: false,
      status: 'confirmed',
      organizationId: orgId,
      contactId: contact?._id,
      assignedTo: userId,
      createdBy: userId,
    });

    logger.info(`[AppointmentNotification] New appointment created with ID ${newAppointment._id}`);
    const notifResult = await sendAppointmentConfirmedNotification(newAppointment);

    return {
      success: true,
      action: 'created',
      appointmentId: newAppointment._id,
      notification: notifResult,
      message: 'New appointment created and confirmation notification sent'
    };
  } catch (err) {
    logger.error(`[AppointmentNotification] processGoogleCalendarEvent error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getWhatsAppCredentials,
  sanitizePhoneNumber,
  formatAppointmentDate,
  formatAppointmentTime,
  extractPhoneFromText,
  extractNameFromPayload,
  sendAppointmentConfirmedNotification,
  sendAppointmentReminderNotification,
  sendAppointmentRescheduledNotification,
  sendAppointmentCancelledNotification,
  sendAppointmentThankYouNotification,
  processGoogleCalendarEvent,
  DEFAULT_SUBJECT,
  DEFAULT_CANCEL_REASON,
  GOOGLE_CALENDAR_ID,
  BOOKING_URL,
};
