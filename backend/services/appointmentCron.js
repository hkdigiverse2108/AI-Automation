const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const Contact = require('../models/Contact');
const { createNotification } = require('./notificationService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

function startAppointmentCron() {
  // Run minutely
  cron.schedule('* * * * *', async () => {
    logger.info('[AppointmentCron] Checking upcoming appointments...');
    const now = new Date();
    try {
      // Find appointments that are:
      // 1. pending or confirmed
      // 2. scheduled in the future
      // 3. not yet reminded
      const appointments = await Appointment.find({
        status: { $in: ['pending', 'confirmed'] },
        reminded: { $ne: true },
        scheduledAt: { $gt: now }
      });

      for (const appt of appointments) {
        const diffMs = appt.scheduledAt.getTime() - now.getTime();
        const diffMins = diffMs / (60 * 1000);
        const reminderWindow = appt.reminderTime || 15;

        // If the appointment falls within the reminder window (e.g. less than or equal to 15 mins away)
        if (diffMins <= reminderWindow) {
          appt.reminded = true;
          await appt.save();

          // Fetch contact details for a descriptive message
          const contact = await Contact.findById(appt.contactId).lean();
          const contactName = contact ? (contact.name || contact.phone) : 'Customer';

          logger.info(`[AppointmentCron] Sending reminder for appointment ${appt._id} to user ${appt.assignedTo}`);

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
    } catch (err) {
      logger.error('[AppointmentCron] Scheduler check error:', err.message);
    }
  });

  logger.info('[AppointmentCron] Scheduler successfully initialized (checks minutely).');
}

module.exports = { startAppointmentCron };
