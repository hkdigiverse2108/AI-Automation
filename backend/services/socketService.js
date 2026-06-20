const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const { getRedisClient } = require('../config/redis');
const redis = getRedisClient();

function initSocketService(io) {
  // Clear online users status on startup to avoid stale session counts
  redis.del('online_users').catch(err => logger.error('Failed to clear online_users on startup:', err.message));

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || user.isDeleted) return next(new Error('User not found or deleted'));

      if (user.isSuspended) return next(new Error('Account suspended'));

      // Organization suspension checks
      if (user.role !== 'superadmin' && user.organizationId) {
        const Organization = require('../models/Organization');
        const org = await Organization.findById(user.organizationId);
        if (org && (org.status === 'suspended' || org.status === 'inactive')) {
          return next(new Error('Organization account suspended or inactive'));
        }
        if (org && org.subscriptionStatus === 'expired') {
          return next(new Error('Subscription expired'));
        }
      }

      socket.userId = user._id.toString();
      socket.userName = user.name;
      socket.ownerId = user.ownerId ? user.ownerId.toString() : null;
      socket.organizationId = user.organizationId ? user.organizationId.toString() : null;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`Socket connected: ${userId}`);

    // Join user room
    socket.join(`user_${userId}`);
    if (socket.ownerId) {
      socket.join(`user_${socket.ownerId}`);
      logger.info(`Socket ${userId} joined tenant room: user_${socket.ownerId}`);
    }

    // Join organization room for team features
    if (socket.organizationId) {
      socket.join(`organization_${socket.organizationId}`);
      // Notify other team members that user is online
      socket.to(`organization_${socket.organizationId}`).emit('team_user_online', { userId, name: socket.userName });
    }

    // Update user presence on connection
    User.findByIdAndUpdate(userId, { lastSeenAt: new Date() }).catch((err) =>
      logger.error(`Failed to update lastSeenAt on connect: ${err.message}`)
    );

    // Track online users using Redis Hash to support multi-instance scaling
    redis.hincrby('online_users', userId, 1)
      .then((newVal) => {
        if (newVal === 1) {
          io.emit('user_online', { userId, name: socket.userName });
        }
      })
      .catch((err) => logger.error(`Failed to increment online users in Redis: ${err.message}`));

    // Handle typing indicator
    socket.on('typing', (data) => {
      socket.to(`user_${userId}`).emit('agent_typing', {
        conversationId: data.conversationId,
        agentName: socket.userName,
      });
    });

    // Handle joining conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
    });

    // --- Team Chat Event Handlers ---
    socket.on('team_join_chat', (chatId) => {
      socket.join(`team_chat_${chatId}`);
      logger.info(`User ${userId} joined team chat room: team_chat_${chatId}`);
    });

    socket.on('team_leave_chat', (chatId) => {
      socket.leave(`team_chat_${chatId}`);
      logger.info(`User ${userId} left team chat room: team_chat_${chatId}`);
    });

    socket.on('team_typing', (data) => {
      // Broadcast typing state to other members in the team chat
      socket.to(`team_chat_${data.chatId}`).emit('team_typing_update', {
        chatId: data.chatId,
        userId: userId,
        userName: socket.userName,
        isTyping: data.isTyping
      });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${userId}`);
      
      // Update user presence on disconnection
      User.findByIdAndUpdate(userId, { lastSeenAt: new Date() }).catch((err) =>
        logger.error(`Failed to update lastSeenAt on disconnect: ${err.message}`)
      );

      // Notify other team members that user is offline
      if (socket.organizationId) {
        socket.to(`organization_${socket.organizationId}`).emit('team_user_offline', { userId });
      }

      redis.hincrby('online_users', userId, -1)
        .then(async (newVal) => {
          if (newVal <= 0) {
            await redis.hdel('online_users', userId);
            io.emit('user_offline', { userId });
          }
        })
        .catch((err) => logger.error(`Failed to decrement online users in Redis: ${err.message}`));
    });
  });

  logger.info('Socket.io service initialized');
}

async function getOnlineUsers() {
  try {
    const keys = await redis.hkeys('online_users');
    return keys;
  } catch (err) {
    logger.error(`Failed to get online users from Redis: ${err.message}`);
    return [];
  }
}

module.exports = { initSocketService, getOnlineUsers };
