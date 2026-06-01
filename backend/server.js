const express = require('express');
const http = require('http');
const path = require('path');
const compression = require('compression');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getRedisClient } = require('./config/redis');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { applySecurity } = require('./middleware/security');
const { globalLimiter } = require('./middleware/rateLimiter');
const { initSocketService } = require('./services/socketService');
const { initQueues } = require('./services/queueService');
const webhookRoutes = require('./routes/webhook');
const winston = require('winston');

const logger = winston.createLogger({
  level: env.isProd() ? 'info' : 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    ...(env.isProd() ? [new winston.transports.File({ filename: 'error.log', level: 'error' })] : []),
  ],
});

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: { origin: env.ALLOWED_ORIGINS, credentials: true },
  pingTimeout: 60000,
});

if (process.env.USE_REDIS_SOCKETS !== 'false') {
  try {
    const pubClient = getRedisClient();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.io Redis adapter configured successfully');
  } catch (err) {
    logger.error('Failed to configure Socket.io Redis adapter:', err.message);
  }
}

app.set('io', io);

// Raw body for webhook signature verification (MUST be before JSON parser)
app.use('/api/webhook', express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Security
applySecurity(app);

// Compression
app.use(compression());

// Global rate limit
app.use('/api', globalLimiter);

// Request logging
if (env.isDev()) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });
}

// Routes & Controller Mappings
const authRoute = require('./routes/auth');
const messagesRoute = require('./routes/messages');
const contactsRoute = require('./routes/contacts');
const campaignsRoute = require('./routes/campaigns');
const flowsRoute = require('./routes/flows');
const templatesRoute = require('./routes/templates');
const adminRoute = require('./routes/admin');
const integrationsRoute = require('./routes/integrations');
const teamRoute = require('./routes/team');
const tagsRoute = require('./routes/tags');
const sequencesRoute = require('./routes/sequences');
const triggersRoute = require('./routes/triggers');
const chatLogsRoute = require('./routes/chat-logs');
const analyticsRoute = require('./routes/analytics');
const notificationsRoute = require('./routes/notifications');
const mediaRoute = require('./routes/media');

const mountRoutes = (prefix) => {
  app.use(`${prefix}/auth`, authRoute);
  app.use(`${prefix}/media`, mediaRoute);
  app.use(`${prefix}/webhook`, webhookRoutes);
  app.use(`${prefix}/messages`, messagesRoute);
  app.use(`${prefix}/contacts`, contactsRoute);
  app.use(`${prefix}/campaigns`, campaignsRoute);
  app.use(`${prefix}/flows`, flowsRoute);
  app.use(`${prefix}/templates`, templatesRoute);
  app.use(`${prefix}/admin`, adminRoute);
  app.use(`${prefix}/settings/integrations`, integrationsRoute);
  app.use(`${prefix}/team`, teamRoute);
  app.use(`${prefix}/tags`, tagsRoute);
  app.use(`${prefix}/sequences`, sequencesRoute);
  app.use(`${prefix}/triggers`, triggersRoute);
  app.use(`${prefix}/chat-logs`, chatLogsRoute);
  app.use(`${prefix}/analytics`, analyticsRoute);
  app.use(`${prefix}/notifications`, notificationsRoute);
};

// Mount versioned API routes
mountRoutes('/api/v1');
mountRoutes('/api'); // Legacy support

// Health check
app.get(['/api/health', '/api/v1/health'], (_req, res) => {
  res.json({ success: true, message: 'WhatsApp Platform API is running', timestamp: new Date() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: env.isProd() ? 'Internal server error' : err.message,
    code: 'SERVER_ERROR',
  });
});

// Start server
async function startServer() {
  try {
    await connectDB();

    // Init socket service
    initSocketService(io);
    webhookRoutes.setIO(io);

    // Init notification service
    const notificationService = require('./services/notificationService');
    notificationService.setIO(io);

    // Init Bull queues (skip if no Redis in dev)
    try {
      initQueues(io);
    } catch (err) {
      logger.warn('Redis/Bull queues not available:', err.message);
    }

    server.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await disconnectDB();
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => { process.exit(1); }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => { logger.error('Unhandled rejection:', err); });
process.on('uncaughtException', (err) => { logger.error('Uncaught exception:', err); process.exit(1); });

startServer();

module.exports = { app, server };
