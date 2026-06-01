const Notification = require('../models/Notification');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

/**
 * Create a new notification and emit it in real-time
 * @param {Object} params
 * @param {string} params.userId - Target user/owner ID
 * @param {string} params.organizationId - Target organization ID
 * @param {string} params.type - 'system' | 'campaign' | 'contact' | 'bot' | 'team' | 'message'
 * @param {string} params.title - Title of the notification
 * @param {string} params.message - Body content of the notification
 * @param {string} params.link - Optional path to navigate to when clicked
 * @param {Object} params.metadata - Optional extra metadata
 */
async function createNotification({ userId, organizationId, type, title, message, link = '', metadata = {} }) {
  try {
    if (!userId || !organizationId) {
      logger.warn('Skipping notification creation due to missing userId or organizationId', { userId, organizationId });
      return null;
    }

    const notif = await Notification.create({
      user: userId,
      organization: organizationId,
      type,
      title,
      message,
      link,
      metadata
    });

    if (ioInstance) {
      ioInstance.to(`user_${userId}`).emit('new_notification', notif.toObject());
      // Also emit a general unread-count update
      const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });
      ioInstance.to(`user_${userId}`).emit('unread_notifications_count', { count: unreadCount });
    }

    return notif;
  } catch (err) {
    logger.error('Failed to create notification:', err.message);
    return null;
  }
}

module.exports = {
  setIO,
  createNotification
};
