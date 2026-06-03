const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const env = require('../config/env');
const { hashSHA256 } = require('../services/encryption');

/**
 * Generate access + refresh token pair.
 */
async function generateTokens(user, req) {
  const ipHash = crypto.createHash('sha256').update(req.ip || '').digest('hex').slice(0, 16);
  const ua = (req.headers['user-agent'] || '').slice(0, 100);
  const family = crypto.randomUUID();

  const accessToken = jwt.sign(
    { id: user._id, role: user.role, ipHash },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  const refreshTokenValue = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: user._id,
    token: refreshTokenValue,
    userAgent: ua,
    ipHash,
    expiresAt,
    family,
  });

  return { accessToken, refreshToken: refreshTokenValue, family };
}

/**
 * Verify JWT middleware.
 */
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Access token required', code: 'NO_TOKEN' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      return res.status(401).json({ success: false, error: 'Invalid or expired token', code });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.isDeleted) {
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ success: false, error: 'Account has been suspended', code: 'ACCOUNT_SUSPENDED' });
    }

    if (user.isLocked()) {
      return res.status(423).json({ success: false, error: 'Account is locked', code: 'ACCOUNT_LOCKED' });
    }

    // Self-healing migration for Organization ID
    if (user.role !== 'superadmin' && !user.organizationId) {
      const Organization = require('../models/Organization');
      if (user.role === 'agent') {
        if (user.ownerId) {
          const owner = await User.findById(user.ownerId);
          if (owner) {
            if (!owner.organizationId) {
              let org = await Organization.findOne({ contactEmail: owner.email });
              if (!org) {
                org = await Organization.create({
                  name: `${owner.name}'s Organization`,
                  contactEmail: owner.email,
                  plan: owner.plan || 'free',
                  status: 'active'
                });
              }
              owner.organizationId = org._id;
              await owner.save();
            }
            user.organizationId = owner.organizationId;
            await user.save();
          }
        }
      } else {
        // admin / owner
        let org = await Organization.findOne({ contactEmail: user.email });
        if (!org) {
          org = await Organization.create({
            name: `${user.name}'s Organization`,
            contactEmail: user.email,
            plan: user.plan || 'free',
            status: 'active'
          });
        }
        user.organizationId = org._id;
        await user.save();
      }
    }

    // Organization suspension checks
    if (user.role !== 'superadmin' && user.organizationId) {
      const Organization = require('../models/Organization');
      const org = await Organization.findById(user.organizationId);
      if (org && (org.status === 'suspended' || org.status === 'inactive')) {
        // Allow subscription routes through even if org is inactive (so they can renew)
        const reqPath = req.originalUrl || req.url || '';
        const isSubscriptionRoute = reqPath.includes('/subscription');
        const isAuthRoute = reqPath.includes('/auth');
        if (!isSubscriptionRoute && !isAuthRoute) {
          return res.status(403).json({ success: false, error: 'Your organization account has been suspended or is inactive', code: 'ORGANIZATION_SUSPENDED' });
        }
      }

      // Subscription expiry check
      if (org && org.subscriptionStatus === 'expired') {
        const reqPath = req.originalUrl || req.url || '';
        const isSubscriptionRoute = reqPath.includes('/subscription');
        const isAuthRoute = reqPath.includes('/auth');
        const isNotificationRoute = reqPath.includes('/notifications');
        if (!isSubscriptionRoute && !isAuthRoute && !isNotificationRoute) {
          return res.status(403).json({
            success: false,
            error: 'Your subscription has expired. Please renew to continue using the platform.',
            code: 'SUBSCRIPTION_EXPIRED',
            data: { expiryDate: org.subscriptionExpiryDate }
          });
        }
      }
    }

    req.user = user;
    req.organizationId = user.organizationId;
    req.userId = user.role === 'agent' ? user.ownerId : user._id;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Authentication failed', code: 'AUTH_ERROR' });
  }
}

/**
 * Refresh access token using refresh token.
 */
async function refreshAccessToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required', code: 'NO_REFRESH' });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token', code: 'INVALID_REFRESH' });
    }

    // Detect token reuse — if already revoked, revoke entire family
    if (storedToken.isRevoked) {
      await RefreshToken.updateMany({ family: storedToken.family }, { isRevoked: true });
      return res.status(401).json({ success: false, error: 'Token reuse detected, all sessions revoked', code: 'TOKEN_REUSE' });
    }

    if (storedToken.expiresAt < new Date()) {
      return res.status(401).json({ success: false, error: 'Refresh token expired', code: 'REFRESH_EXPIRED' });
    }

    const user = await User.findById(storedToken.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ success: false, error: 'Account has been suspended', code: 'ACCOUNT_SUSPENDED' });
    }

    // Revoke old token
    storedToken.isRevoked = true;

    // Generate new token pair (rotation)
    const ipHash = crypto.createHash('sha256').update(req.ip || '').digest('hex').slice(0, 16);
    const newRefreshTokenValue = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    storedToken.replacedByToken = newRefreshTokenValue;
    await storedToken.save();

    await RefreshToken.create({
      userId: user._id,
      token: newRefreshTokenValue,
      userAgent: (req.headers['user-agent'] || '').slice(0, 100),
      ipHash,
      expiresAt,
      family: storedToken.family,
    });

    const accessToken = jwt.sign(
      { id: user._id, role: user.role, ipHash },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshTokenValue },
      message: 'Token refreshed',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Token refresh failed', code: 'REFRESH_ERROR' });
  }
}

/**
 * API Key authentication middleware.
 */
async function verifyApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API key required', code: 'NO_API_KEY' });
    }

    const keyHash = hashSHA256(apiKey);
    const user = await User.findOne({ apiKeyHash: keyHash }).select('+apiKeyHash +apiKeyScope');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid API key', code: 'INVALID_API_KEY' });
    }

    if (user.apiKeyExpiresAt && user.apiKeyExpiresAt < new Date()) {
      return res.status(401).json({ success: false, error: 'API key expired', code: 'API_KEY_EXPIRED' });
    }

    req.user = user;
    req.userId = user._id;
    req.apiKeyScope = user.apiKeyScope || 'read';
    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'API key verification failed', code: 'API_KEY_ERROR' });
  }
}

/**
 * Role-based access control.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions', code: 'FORBIDDEN' });
    }
    next();
  };
}

module.exports = { verifyToken, generateTokens, refreshAccessToken, verifyApiKey, requireRole };
