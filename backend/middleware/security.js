const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const env = require('../config/env');

/**
 * Apply all security middleware to the Express app.
 */
function applySecurity(app) {
  // 1. Helmet — Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", ...env.ALLOWED_ORIGINS],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      frameguard: { action: 'deny' },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // 2. CORS — only allowed origins
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin || env.isDev()) {
          return callback(null, true);
        }
        const normalizedOrigin = origin.replace(/\/$/, '');
        const allowed = env.ALLOWED_ORIGINS.map(url => url.replace(/\/$/, ''));
        
        const isHkDigiverse = normalizedOrigin.endsWith('.hkdigiverse.com') || normalizedOrigin === 'https://hkdigiverse.com';
        
        if (
          allowed.includes(normalizedOrigin) ||
          normalizedOrigin.includes('ngrok-free.app') ||
          normalizedOrigin.includes('ngrok.io') ||
          isHkDigiverse
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
      maxAge: 86400,
    })
  );

  // 3. NoSQL injection prevention
  app.use(mongoSanitize({ replaceWith: '_', allowDots: false }));

  // 4. XSS clean — simple sanitizer
  app.use((req, _res, next) => {
    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key]
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/javascript:/gi, '');
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
      return obj;
    };
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
  });

  // 5. Force HTTPS in production
  if (env.isProd()) {
    app.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(301, `https://${req.hostname}${req.url}`);
      }
      next();
    });
  }
}

module.exports = { applySecurity };
