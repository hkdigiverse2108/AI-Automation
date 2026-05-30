const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const connectedUsers = new Map(); // userId -> Set of socket ids

function initSocketService(io) {
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

    // Track online users
    if (!connectedUsers.has(userId)) connectedUsers.set(userId, new Set());
    connectedUsers.get(userId).add(socket.id);

    // Broadcast online status
    io.emit('user_online', { userId, name: socket.userName });

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
      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
          io.emit('user_offline', { userId });
        }
      }
    });
  });

  logger.info('Socket.io service initialized');
}

function getOnlineUsers() {
  return Array.from(connectedUsers.keys());
}

module.exports = { initSocketService, getOnlineUsers };
