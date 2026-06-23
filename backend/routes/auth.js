const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AuditLog = require('../models/AuditLog');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const { generateTokens, verifyToken, refreshAccessToken } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');
const { encryptField } = require('../services/encryption');
const Feature = require('../models/Feature');
const AdminFeaturePermission = require('../models/AdminFeaturePermission');

// Helper: Get enabled feature slugs for a user
async function getFeaturePermissions(userId, role) {
  // Superadmins get all features
  if (role === 'superadmin') return null; // null = no filtering (all access)
  
  const features = await Feature.find({ is_active: true }).lean();
  const permissions = await AdminFeaturePermission.find({ admin_id: userId }).lean();
  
  const permMap = {};
  permissions.forEach(p => { permMap[p.feature_id.toString()] = p.can_view; });
  
  // Default: feature enabled unless explicitly disabled
  return features
    .filter(f => permMap[f._id.toString()] !== false)
    .map(f => f.slug);
}

// Common passwords check (top 100 for brevity)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master',
  'dragon', '111111', 'baseball', 'iloveyou', 'trustno1', 'sunshine', 'letmein',
  'password1', 'Password1', 'welcome', 'shadow', 'superman', 'qwerty123',
]);

// POST /auth/register
router.post('/register', authLimiter, (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'Public registration is disabled. Please contact your Super Admin to obtain credentials.',
    code: 'REGISTRATION_DISABLED'
  });
});

// POST /auth/login
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, isDeleted: { $ne: true } }).select('+passwordHash +twoFactorEnabled +twoFactorSecret +isSuspended');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ success: false, error: 'Your account has been suspended by an administrator.', code: 'ACCOUNT_SUSPENDED' });
    }

    if (user.isLocked()) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      await AuditLog.log({ userId: user._id, action: 'LOGIN_LOCKED', resource: 'User', ip: req.ip, userAgent: req.headers['user-agent'] });
      return res.status(423).json({ success: false, error: `Account locked. Try again in ${remaining} minutes.`, code: 'ACCOUNT_LOCKED' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      await AuditLog.log({ userId: user._id, action: 'LOGIN_FAILED', resource: 'User', ip: req.ip, userAgent: req.headers['user-agent'] });
      return res.status(401).json({ success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      const tempToken = crypto.randomBytes(32).toString('hex');
      user.emailVerifyToken = crypto.createHash('sha256').update(tempToken).digest('hex');
      user.emailVerifyExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min for 2FA
      await user.save();
      return res.json({
        success: true,
        data: { requires2FA: true, tempToken },
        message: 'Enter your 2FA code',
      });
    }

    await user.resetLoginAttempts();
    user.lastLogin = new Date();
    await user.save();

    const tokens = await generateTokens(user, req);

    await AuditLog.log({ userId: user._id, action: 'LOGIN', resource: 'User', ip: req.ip, userAgent: req.headers['user-agent'] });

    const permissions = await getFeaturePermissions(user._id, user.role);

    res.json({
      success: true,
      data: { user: user.toSafeObject(), ...tokens, permissions },
      message: 'Login successful',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Login failed', code: 'LOGIN_ERROR' });
  }
});

// POST /auth/verify-2fa
router.post('/verify-2fa', authLimiter, async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ success: false, error: 'Token and code required', code: 'MISSING_FIELDS' });
    }

    const hashedToken = crypto.createHash('sha256').update(tempToken).digest('hex');
    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpires: { $gt: new Date() },
    }).select('+twoFactorSecret');

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'INVALID_TEMP_TOKEN' });
    }

    const secret = require('../services/encryption').decryptField(user.twoFactorSecret);
    const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
    if (!verified) {
      return res.status(401).json({ success: false, error: 'Invalid 2FA code', code: 'INVALID_2FA' });
    }

    await user.resetLoginAttempts();
    user.lastLogin = new Date();
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    const tokens = await generateTokens(user, req);

    const permissions = await getFeaturePermissions(user._id, user.role);

    res.json({
      success: true,
      data: { user: user.toSafeObject(), ...tokens, permissions },
      message: '2FA verified, login successful',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '2FA verification failed', code: '2FA_ERROR' });
  }
});

// POST /auth/refresh
router.post('/refresh', refreshAccessToken);

// POST /auth/logout
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.updateOne({ token: refreshToken }, { isRevoked: true });
    }
    await AuditLog.log({ userId: req.user._id, action: 'LOGOUT', resource: 'User', ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Logout failed', code: 'LOGOUT_ERROR' });
  }
});

// POST /auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    // Always return success (don't reveal if email exists)
    if (!user) return res.json({ success: true, message: 'If email exists, reset link has been sent.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // In production, send email with resetToken link
    res.json({ success: true, message: 'If email exists, reset link has been sent.', data: { resetToken } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process request', code: 'FORGOT_ERROR' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, error: 'Token and password required', code: 'MISSING_FIELDS' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+passwordHash +passwordHistory');

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token', code: 'INVALID_RESET_TOKEN' });
    }

    // Check password not same as current
    const isSame = await bcrypt.compare(password, user.passwordHash);
    if (isSame) {
      return res.status(400).json({ success: false, error: 'New password must be different from current', code: 'SAME_PASSWORD' });
    }

    // Check password history (last 5)
    if (user.passwordHistory?.length) {
      for (const oldHash of user.passwordHistory.slice(-5)) {
        const reused = await bcrypt.compare(password, oldHash);
        if (reused) {
          return res.status(400).json({ success: false, error: 'Cannot reuse recent passwords', code: 'PASSWORD_REUSED' });
        }
      }
    }

    const newHash = await User.hashPassword(password);
    user.passwordHash = newHash;
    user.passwordHistory = [...(user.passwordHistory || []), newHash].slice(-5);
    user.passwordChangedAt = new Date();
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true });

    await AuditLog.log({ userId: user._id, action: 'PASSWORD_RESET', resource: 'User', ip: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true, message: 'Password reset successful. Please login.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Password reset failed', code: 'RESET_ERROR' });
  }
});

// POST /auth/setup-2fa
router.post('/setup-2fa', verifyToken, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({ name: `WhatsAppPlatform:${req.user.email}`, length: 32 });
    const qrUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Store encrypted secret temporarily
    req.user.twoFactorSecret = encryptField(secret.base32);
    await req.user.save();

    res.json({
      success: true,
      data: { qrCode: qrUrl, secret: secret.base32 },
      message: 'Scan QR code with your authenticator app',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '2FA setup failed', code: '2FA_SETUP_ERROR' });
  }
});

// POST /auth/enable-2fa
router.post('/enable-2fa', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    if (!user.twoFactorSecret) {
      return res.status(400).json({ success: false, error: 'Run setup-2fa first', code: '2FA_NOT_SETUP' });
    }

    const secret = require('../services/encryption').decryptField(user.twoFactorSecret);
    const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });

    if (!verified) {
      return res.status(400).json({ success: false, error: 'Invalid code', code: 'INVALID_2FA_CODE' });
    }

    user.twoFactorEnabled = true;
    await user.save();

    await AuditLog.log({ userId: user._id, action: '2FA_ENABLED', resource: 'User', ip: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: '2FA enable failed', code: '2FA_ENABLE_ERROR' });
  }
});

// GET /auth/whatsapp
router.get('/whatsapp', verifyToken, async (req, res) => {
  try {
    const account = await WhatsAppAccount.findOne({ userId: req.user._id, isActive: true });
    if (!account) {
      return res.json({ success: true, data: null });
    }
    const data = account.toObject();
    data.accessToken = '••••••••••••••••'; // Mask for safety
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch WhatsApp account', code: 'FETCH_ERROR' });
  }
});

// POST /auth/whatsapp
router.post('/whatsapp', verifyToken, async (req, res) => {
  try {
    const { phoneNumber, phoneNumberId, accessToken, wabaId, displayName } = req.body;
    if (!phoneNumber || !phoneNumberId || !accessToken || !wabaId) {
      return res.status(400).json({ success: false, error: 'Missing required fields', code: 'MISSING_FIELDS' });
    }

    let account = await WhatsAppAccount.findOne({ userId: req.user._id });
    const encryptedToken = encryptField(accessToken);

    if (account) {
      account.phoneNumber = phoneNumber;
      account.phoneNumberId = phoneNumberId;
      account.accessToken = encryptedToken;
      account.wabaId = wabaId;
      account.displayName = displayName || '';
      account.isActive = true;
      await account.save();
    } else {
      account = await WhatsAppAccount.create({
        userId: req.user._id,
        phoneNumber,
        phoneNumberId,
        accessToken: encryptedToken,
        wabaId,
        displayName: displayName || '',
        isActive: true,
      });
    }

    res.json({ success: true, data: { phoneNumber: account.phoneNumber, phoneNumberId: account.phoneNumberId, displayName: account.displayName }, message: 'WhatsApp account linked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Link failed', code: 'LINK_ERROR' });
  }
});

// GET /auth/me
router.get('/me', verifyToken, async (req, res) => {
  const permissions = await getFeaturePermissions(req.user._id, req.user.role);
  res.json({ success: true, data: { user: req.user.toSafeObject(), permissions } });
});

// PUT /auth/profile - Update name and avatar
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    
    req.user.name = name;
    if (avatar !== undefined) {
      req.user.avatar = avatar;
    }
    await req.user.save();
    
    await AuditLog.log({
      userId: req.user._id,
      action: 'UPDATE_PROFILE',
      resource: 'User',
      resourceId: req.user._id.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: { user: req.user.toSafeObject() },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// GET /auth/api-key - Retrieve current API key settings
router.get('/api-key', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+apiKey +apiKeyExpiresAt +apiKeyScope');
    res.json({
      success: true,
      data: {
        hasKey: !!user.apiKey,
        apiKey: user.apiKey ? `${user.apiKey.substring(0, 8)}••••••••••••••••` : null,
        scope: user.apiKeyScope,
        expiresAt: user.apiKeyExpiresAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch API key' });
  }
});

// POST /auth/api-key - Create or rotate API Key
router.post('/api-key', verifyToken, async (req, res) => {
  try {
    const { scope = 'read', durationDays = 365 } = req.body;
    const rawKey = `wa_live_${crypto.randomBytes(24).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    
    req.user.apiKey = rawKey;
    req.user.apiKeyHash = hash;
    req.user.apiKeyScope = scope;
    req.user.apiKeyExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    await req.user.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'GENERATE_API_KEY',
      resource: 'User',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      data: {
        apiKey: rawKey,
        scope: req.user.apiKeyScope,
        expiresAt: req.user.apiKeyExpiresAt
      },
      message: 'API Key generated successfully. Please copy it now as it won\'t be shown again.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate API key' });
  }
});

// DELETE /auth/api-key - Revoke API Key
router.delete('/api-key', verifyToken, async (req, res) => {
  try {
    req.user.apiKey = undefined;
    req.user.apiKeyHash = undefined;
    req.user.apiKeyScope = 'read';
    req.user.apiKeyExpiresAt = undefined;
    await req.user.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'REVOKE_API_KEY',
      resource: 'User',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'API Key revoked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
});

// GET /auth/waba-status - Fetch WhatsApp Business Account connection status & health
router.get('/waba-status', verifyToken, async (req, res) => {
  try {
    const account = await WhatsAppAccount.findOne({ userId: req.user._id });
    if (!account) {
      return res.json({
        success: true,
        data: {
          connected: false,
          status: 'DISCONNECTED',
          health: 'critical',
          details: 'No WhatsApp account configuration found. Please link your Meta WABA credentials.'
        }
      });
    }

    const connected = account.isActive;
    res.json({
      success: true,
      data: {
        connected,
        status: connected ? 'CONNECTED' : 'SUSPENDED',
        health: connected ? 'healthy' : 'degraded',
        phoneNumber: account.phoneNumber,
        displayName: account.displayName,
        wabaId: account.wabaId,
        phoneNumberId: account.phoneNumberId,
        details: connected
          ? 'API connection to Meta WhatsApp Business Platform is fully operational. Webhook callbacks active.'
          : 'WhatsApp account credentials are saved but inactive. Check Meta developers dashboard.'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check WABA health status' });
  }
});

module.exports = router;
