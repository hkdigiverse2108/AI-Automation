const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX, 10) || (env.isDev() ? 100000 : 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.', code: 'RATE_LIMIT' },
  keyGenerator: (req) => req.ip,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDev() ? 10000 : 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, try after 15 minutes.', code: 'AUTH_RATE_LIMIT' },
  keyGenerator: (req) => req.ip,
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX, 10) || (env.isDev() ? 100000 : 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Webhook rate limit exceeded.', code: 'WEBHOOK_RATE_LIMIT' },
});

const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX, 10) || (env.isDev() ? 100000 : 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  message: { success: false, error: 'API rate limit exceeded.', code: 'API_RATE_LIMIT' },
});

module.exports = { globalLimiter, authLimiter, webhookLimiter, apiKeyLimiter };
