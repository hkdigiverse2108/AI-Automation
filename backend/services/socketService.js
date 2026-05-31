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
      if (!user) return next(new Error('User not found'));

       socket.userId = user._id.toString();
      socket.userName = user.name;
      socket.ownerId = user.ownerId ? user.ownerId.toString() : null;
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

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${userId}`);
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
