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
  cors: {
    origin: (origin, callback) => {
      if (!origin || env.isDev()) {
        return callback(null, true);
      }
      const normalizedOrigin = origin.replace(/\/$/, '');
      const allowed = env.ALLOWED_ORIGINS.map(url => url.replace(/\/$/, ''));
      if (
        allowed.includes(normalizedOrigin) ||
        normalizedOrigin.includes('ngrok-free.app') ||
        normalizedOrigin.includes('ngrok.io')
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
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

// Fallback route for missing uploads (to handle media sync during local development with shared DB)
const handleUploadsFallback = async (req, res, next) => {
  const fs = require('fs');
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  // If file exists, let Express static serve it
  if (fs.existsSync(filePath)) {
    return next();
  }

  // Check if it's an incoming whatsapp media file
  const match = filename.match(/^incoming-(wamid\.[a-zA-Z0-9_\-\.\+=]+)\.([a-zA-Z0-9]+)$/);
  if (!match) {
    return next();
  }

  const metaMessageId = match[1];
  logger.info(`[UPLOADS FALLBACK] Missing file requested: ${filename}. Attempting to resolve via metaMessageId: ${metaMessageId}`);

  try {
    const Message = require('./models/Message');
    const msg = await Message.findOne({ metaMessageId });
    if (!msg || !msg.content?.mediaId) {
      logger.warn(`[UPLOADS FALLBACK] No message or media ID found for metaMessageId: ${metaMessageId}`);
      return next();
    }

    const WhatsAppAccount = require('./models/WhatsAppAccount');
    const waAccount = await WhatsAppAccount.findOne({ userId: msg.userId, isActive: true });
    if (!waAccount) {
      logger.warn(`[UPLOADS FALLBACK] No active WhatsApp account found for user: ${msg.userId}`);
      return next();
    }

    const { decryptField } = require('./services/encryption');
    const token = decryptField(waAccount.accessToken);
    const whatsapp = require('./services/whatsapp');

    // Create uploads directory if missing
    const uploadDir = path.dirname(filePath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    logger.info(`[UPLOADS FALLBACK] Triggering download for missing media ID: ${msg.content.mediaId}`);
    const dlResult = await whatsapp.downloadMedia(msg.content.mediaId, token, filePath);
    
    if (dlResult.success) {
      if (dlResult.url && dlResult.url.startsWith('http')) {
        logger.info(`[UPLOADS FALLBACK] Media was uploaded to Cloudinary: ${dlResult.url}. Redirecting...`);
        msg.content.mediaUrl = dlResult.url;
        await msg.save();
        return res.redirect(dlResult.url);
      }
      
      logger.info(`[UPLOADS FALLBACK] Serving downloaded local file: ${filePath}`);
      return res.sendFile(filePath);
    } else {
      logger.error(`[UPLOADS FALLBACK] Failed to download media: ${dlResult.error}`);
      return next();
    }
  } catch (err) {
    logger.error(`[UPLOADS FALLBACK] Error resolving missing file:`, err);
    return next();
  }
};

app.get('/uploads/:filename', handleUploadsFallback);
app.get('/api/uploads/:filename', handleUploadsFallback);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

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
const subscriptionRoute = require('./routes/subscription');
const telephonyRoute = require('./routes/telephony');
const groupsRoute = require('./routes/groups');
const followUpsRoute = require('./routes/followups');
const teamChatRoute = require('./routes/team-chat');

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
  app.use(`${prefix}/subscription`, subscriptionRoute);
  app.use(`${prefix}/telephony`, telephonyRoute);
  app.use(`${prefix}/groups`, groupsRoute);
  app.use(`${prefix}/follow-ups`, followUpsRoute);
  app.use(`${prefix}/team-chat`, teamChatRoute);
};

// Mount versioned API routes
mountRoutes('/api/v1');
mountRoutes('/api'); // Legacy support

// Health check
app.get(['/api/health', '/api/v1/health'], (_req, res) => {
  res.json({ success: true, message: 'HK Automation API is running', timestamp: new Date() });
});

// Root path handler for active health check
app.get('/', (_req, res) => {
  res.status(200).json({ success: true, message: 'WhatsApp Marketing API Server is active' });
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

    // Init subscription cron job
    try {
      const { startSubscriptionCron } = require('./services/subscriptionCron');
      startSubscriptionCron();
    } catch (err) {
      logger.warn('Subscription cron failed to start:', err.message);
    }

    // Init follow-up automation cron job
    try {
      const { startFollowUpCron } = require('./services/followUpCron');
      startFollowUpCron();
    } catch (err) {
      logger.warn('Follow-up cron failed to start:', err.message);
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
