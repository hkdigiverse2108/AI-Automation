const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const Contact = require('../models/Contact');
const { createNotification } = require('./notificationService');
const {
  sendAppointmentReminderNotification,
  sendAppointmentThankYouNotification
} = require('./appointmentNotificationService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

function startAppointmentCron() {
  // Run minutely
  cron.schedule('* * * * *', async () => {
    logger.info('[AppointmentCron] Checking upcoming appointments & post-meeting followups...');
    const now = new Date();

    // 1. Process 2-hour appointment reminders
    try {
      const upcomingAppointments = await Appointment.find({
        status: { $in: ['pending', 'confirmed'] },
        reminded: { $ne: true },
        scheduledAt: { $gt: now }
      });

      for (const appt of upcomingAppointments) {
        const diffMs = appt.scheduledAt.getTime() - now.getTime();
        const diffMins = diffMs / (60 * 1000);
        const reminderWindow = appt.reminderTime || 120; // Default 120 mins (2 hours)

        // If the appointment falls within the reminder window
        if (diffMins <= reminderWindow && diffMins > 0) {
          logger.info(`[AppointmentCron] Sending 2-hour reminder for appointment ${appt._id} to ${appt.clientPhone || 'contact'}`);

          // Trigger WhatsApp Template reminder
          if (appt.clientPhone) {
            await sendAppointmentReminderNotification(appt);
          } else {
            appt.reminded = true;
            await appt.save();
          }

          // Also notify assigned user on internal dashboard
          const contact = appt.contactId ? await Contact.findById(appt.contactId).lean() : null;
          const contactName = appt.clientName || (contact ? (contact.name || contact.phone) : 'Customer');

          if (appt.assignedTo && appt.organizationId) {
            await createNotification({
              userId: appt.assignedTo,
              organizationId: appt.organizationId,
              type: 'appointment',
              title: 'Upcoming Appointment Reminder ⏰',
              message: `Your appointment "${appt.title}" with ${contactName} is starting in ${Math.round(diffMins)} minutes.`,
              link: '/dashboard/contacts',
              metadata: { appointmentId: appt._id }
            });
          }
        }
      }
    } catch (err) {
      logger.error('[AppointmentCron] Error during reminder check:', err.message);
    }

    // 2. Process Post-Meeting Thank You Follow-up (15-60 mins after meeting ends)
    try {
      const completedCandidates = await Appointment.find({
        status: 'confirmed',
        'notifications.thankYou.sent': { $ne: true },
        scheduledAt: { $lt: new Date(now.getTime() - 15 * 60 * 1000) } // At least 15 mins passed
      });

      for (const appt of completedCandidates) {
        const duration = appt.duration || 30;
        const meetingEndTime = new Date(appt.scheduledAt.getTime() + duration * 60 * 1000);
        const minsSinceEnd = (now.getTime() - meetingEndTime.getTime()) / (60 * 1000);

        // Send thank you between 15 mins and 120 mins after meeting end
        if (minsSinceEnd >= 15 && minsSinceEnd <= 120 && appt.clientPhone) {
          logger.info(`[AppointmentCron] Triggering Thank You followup for appointment ${appt._id}`);
          await sendAppointmentThankYouNotification(appt);
        }
      }
    } catch (err) {
      logger.error('[AppointmentCron] Error during thank you followup check:', err.message);
    }
  });

  logger.info('[AppointmentCron] Scheduler successfully initialized (checks minutely with 2-hour WhatsApp reminder).');
}

module.exports = { startAppointmentCron };
