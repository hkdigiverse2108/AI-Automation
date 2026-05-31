const router = require('express').Router();
const crypto = require('crypto');
const env = require('../config/env');
const { verifyWebhookSignature, decryptField } = require('../services/encryption');
const Organization = require('../models/Organization');
const botEngine = require('../services/botEngine');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { webhookLimiter } = require('../middleware/rateLimiter');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

let ioInstance = null;
function setIO(io) { ioInstance = io; }

// Helper: Dynamically verify webhook signature using Organization-specific App Secret
async function dynamicVerifySignature(rawBody, signature, reqBody) {
  if (!signature || !rawBody) return false;

  const entry = reqBody?.entry?.[0];
  const wabaId = entry?.id;
  const change = entry?.changes?.[0];
  const phoneNumberId = change?.value?.metadata?.phone_number_id;

  let appSecret = '';

  if (phoneNumberId || wabaId) {
    try {
      const org = await Organization.findOne({
        $or: [
          { 'metaConfig.whatsapp.phoneNumberId': phoneNumberId },
          { 'metaConfig.whatsapp.wabaId': wabaId }
        ]
      });

      if (org && org.metaConfig?.whatsapp?.appSecret) {
        appSecret = decryptField(org.metaConfig.whatsapp.appSecret);
      }
    } catch (err) {
      logger.error('Failed to find organization or decrypt app secret in webhook:', err.message);
    }
  }

  // Fallback to platform-wide default
  if (!appSecret) {
    appSecret = env.META_APP_SECRET;
  }

  if (!appSecret) {
    logger.warn('No Meta App Secret configured for webhook verification.');
    return false;
  }

  // Support sandbox/mock signature bypass (Development Only)
  if (env.isDev() && (signature === 'sha256=mock_signature' || signature.startsWith('sha256=mock'))) {
    logger.info('[MOCK] Webhook signature bypass activated');
    return true;
  }

  const expectedSig =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.toLowerCase()),
      Buffer.from(expectedSig.toLowerCase())
    );
  } catch {
    return false;
  }
}

// GET /webhook — Meta verification challenge
router.get('/', async (req, res) => {
  logger.info('Received GET /webhook verification request');
  logger.info(`Query params: ${JSON.stringify(req.query)}`);
  
  const mode = req.query['hub.mode'] || req.query['hub_mode'] || req.query.hub_mode;
  const token = req.query['hub.verify_token'] || req.query['hub_verify_token'] || req.query.hub_verify_token;
  const challenge = req.query['hub.challenge'] || req.query['hub_challenge'] || req.query.hub_challenge;
  
  logger.info(`Mode: ${mode}, Token: ${token}, Challenge: ${challenge}`);

  if (mode === 'subscribe' && token) {
    // 1. Check platform default token or standard fallbacks for easy setup
    if (
      token === env.META_VERIFY_TOKEN || 
      token === 'myverifytoken123' || 
      token === 'whatsapp_platform_verify_token'
    ) {
      logger.info(`Webhook verified successfully via verify token fallback: ${token}`);
      return res.status(200).send(challenge);
    }

    // 2. Check organization specific verify tokens
    try {
      const org = await Organization.findOne({ 'metaConfig.whatsapp.verifyToken': token });
      if (org) {
        logger.info(`Webhook verified successfully for Organization: ${org.name}`);
        return res.status(200).send(challenge);
      }
    } catch (err) {
      logger.error('Organization verify token lookup failed:', err.message);
    }
  }

  logger.warn('Webhook verification failed');
  return res.status(403).json({ success: false, error: 'Verification failed' });
});

// POST /webhook — Receive messages from Meta
router.post('/', webhookLimiter, async (req, res) => {
  logger.info('--- RECEIVED WEBHOOK EVENT ---');
  const signature = req.headers['x-hub-signature-256'];
  logger.info(`Signature Header: ${signature}`);
  logger.info(`req.rawBody present: ${!!req.rawBody} (length: ${req.rawBody ? req.rawBody.length : 0})`);
  logger.info(`req.body keys: ${JSON.stringify(Object.keys(req.body || {}))}`);

  // Enforce signature check strictly in production
  if (env.isProd()) {
    if (!signature || !req.rawBody) {
      logger.warn('Unsigned webhook event rejected in production');
      return res.status(401).json({ success: false, error: 'Signature required' });
    }
    const isValid = await dynamicVerifySignature(req.rawBody, signature, req.body);
    logger.info(`Signature verification result: ${isValid}`);
    if (!isValid) {
      logger.warn('Invalid webhook signature in production — rejecting');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
  } else {
    // In dev, only verify signature if present, logging warnings otherwise
    if (signature && req.rawBody) {
      const isValid = await dynamicVerifySignature(req.rawBody, signature, req.body);
      logger.info(`Signature verification result: ${isValid}`);
      if (!isValid) {
        logger.warn('Invalid webhook signature in dev — ignoring payload');
        return res.status(200).json({ status: 'ok', warning: 'Invalid signature' });
      }
    } else {
      logger.warn('Skipping webhook signature verification in dev (missing header or rawBody)');
    }
  }

  // ALWAYS return 200 immediately for valid webhooks
  res.status(200).json({ status: 'ok' });

  // Process asynchronously
  processWebhook(req.body).catch((err) => {
    logger.error('Webhook processing error:', err.message);
  });
});

async function processWebhook(body) {
  if (!body?.object || body.object !== 'whatsapp_business_account') return;

  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;

      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id;

      // Handle status updates
      if (value.statuses?.length) {
        for (const status of value.statuses) {
          await handleStatusUpdate(status);
        }
      }

      // Handle incoming messages
      if (value.messages?.length) {
        for (const message of value.messages) {
          message.profile = value.contacts?.[0]?.profile;
          await botEngine.processIncomingMessage(message, phoneNumberId, ioInstance);
        }
      }
    }
  }
}

async function handleStatusUpdate(status) {
  try {
    logger.info(`Received status update: ${JSON.stringify(status)}`);
    const metaMessageId = status.id;
    const newStatus = status.status; // sent, delivered, read, failed

    if (!metaMessageId || !newStatus) return;

    const updateFields = { status: newStatus };
    if (newStatus === 'failed' && status.errors) {
      updateFields.errorDetails = status.errors;
    }

    const msg = await Message.findOneAndUpdate(
      { metaMessageId },
      updateFields,
      { new: true }
    );

    if (msg && ioInstance) {
      ioInstance.to(`user_${msg.userId}`).emit('message_status', {
        messageId: msg._id,
        conversationId: msg.conversationId,
        metaMessageId,
        status: newStatus,
      });
    }

    // Update campaign stats for delivered/read
    if (msg?.campaignId) {
      const Campaign = require('../models/Campaign');
      if (newStatus === 'delivered') {
        await Campaign.updateOne({ _id: msg.campaignId }, { $inc: { 'stats.delivered': 1 } });
      } else if (newStatus === 'read') {
        await Campaign.updateOne({ _id: msg.campaignId }, { $inc: { 'stats.read': 1 } });
      }
    }
  } catch (error) {
    logger.error('Status update error:', error.message);
  }
}

module.exports = router;
module.exports.setIO = setIO;
