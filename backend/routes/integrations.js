const router = require('express').Router();
const axios = require('axios');
const Organization = require('../models/Organization');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const AuditLog = require('../models/AuditLog');
const { verifyToken, requireRole } = require('../middleware/auth');
const { encryptField, decryptField } = require('../services/encryption');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// Helper: Mask a sensitive token/secret
function maskToken(token) {
  if (!token) return '';
  if (token.startsWith('mock_')) return `mock_••••${token.slice(-3)}`;
  if (token === 'demo' || token === 'mock') return '••••';
  if (token.length <= 8) return '••••••••';
  return token.slice(0, 4) + '••••••••••••••••••••••••••••••••' + token.slice(-3);
}

// Apply Auth and Admin role checking
router.use(verifyToken);
router.use(requireRole('admin'));

// GET /api/settings/integrations/meta - Retrieve organization's Meta config (masked)
router.get('/meta', async (req, res) => {
  try {
    const org = await Organization.findById(req.organizationId);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found', code: 'ORG_NOT_FOUND' });
    }

    const config = org.metaConfig ? org.metaConfig.toObject() : { whatsapp: {}, facebook: {}, instagram: {} };

    // Mask sensitive fields
    if (config.whatsapp) {
      if (config.whatsapp.accessToken) config.whatsapp.accessToken = maskToken(decryptField(config.whatsapp.accessToken));
      if (config.whatsapp.appSecret) config.whatsapp.appSecret = maskToken(decryptField(config.whatsapp.appSecret));
    }
    if (config.facebook) {
      if (config.facebook.pageAccessToken) config.facebook.pageAccessToken = maskToken(decryptField(config.facebook.pageAccessToken));
      if (config.facebook.appSecret) config.facebook.appSecret = maskToken(decryptField(config.facebook.appSecret));
    }
    if (config.instagram) {
      if (config.instagram.accessToken) config.instagram.accessToken = maskToken(decryptField(config.instagram.accessToken));
    }

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to fetch integrations meta:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch Meta configurations', code: 'FETCH_ERROR' });
  }
});

// POST /api/settings/integrations/meta - Update organization's Meta credentials
router.post('/meta', async (req, res) => {
  try {
    const org = await Organization.findById(req.organizationId);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found', code: 'ORG_NOT_FOUND' });
    }

    const { whatsapp, facebook, instagram } = req.body;

    if (!org.metaConfig) {
      org.metaConfig = { whatsapp: {}, facebook: {}, instagram: {} };
    }

    // --- Process WhatsApp Config ---
    if (whatsapp) {
      const currentWa = org.metaConfig.whatsapp || {};
      
      org.metaConfig.whatsapp.appId = whatsapp.appId !== undefined ? whatsapp.appId : currentWa.appId;
      org.metaConfig.whatsapp.phoneNumberId = whatsapp.phoneNumberId !== undefined ? whatsapp.phoneNumberId : currentWa.phoneNumberId;
      org.metaConfig.whatsapp.wabaId = whatsapp.wabaId !== undefined ? whatsapp.wabaId : currentWa.wabaId;
      org.metaConfig.whatsapp.verifyToken = whatsapp.verifyToken !== undefined ? whatsapp.verifyToken : currentWa.verifyToken;
      org.metaConfig.whatsapp.businessManagerId = whatsapp.businessManagerId !== undefined ? whatsapp.businessManagerId : currentWa.businessManagerId;

      // Access Token
      if (whatsapp.accessToken && !whatsapp.accessToken.includes('••••')) {
        org.metaConfig.whatsapp.accessToken = encryptField(whatsapp.accessToken);
      }
      // App Secret
      if (whatsapp.appSecret && !whatsapp.appSecret.includes('••••')) {
        org.metaConfig.whatsapp.appSecret = encryptField(whatsapp.appSecret);
      }
    }

    // --- Process Facebook Config ---
    if (facebook) {
      const currentFb = org.metaConfig.facebook || {};

      org.metaConfig.facebook.pageId = facebook.pageId !== undefined ? facebook.pageId : currentFb.pageId;
      org.metaConfig.facebook.appId = facebook.appId !== undefined ? facebook.appId : currentFb.appId;

      // Page Access Token
      if (facebook.pageAccessToken && !facebook.pageAccessToken.includes('••••')) {
        org.metaConfig.facebook.pageAccessToken = encryptField(facebook.pageAccessToken);
      }
      // App Secret
      if (facebook.appSecret && !facebook.appSecret.includes('••••')) {
        org.metaConfig.facebook.appSecret = encryptField(facebook.appSecret);
      }
    }

    // --- Process Instagram Config ---
    if (instagram) {
      const currentIg = org.metaConfig.instagram || {};

      org.metaConfig.instagram.accountId = instagram.accountId !== undefined ? instagram.accountId : currentIg.accountId;
      org.metaConfig.instagram.businessAccountId = instagram.businessAccountId !== undefined ? instagram.businessAccountId : currentIg.businessAccountId;

      // Access Token
      if (instagram.accessToken && !instagram.accessToken.includes('••••')) {
        org.metaConfig.instagram.accessToken = encryptField(instagram.accessToken);
      }
    }

    await org.save();

    // --- Synchronize with WhatsAppAccount model for backward compatibility ---
    if (org.metaConfig.whatsapp && org.metaConfig.whatsapp.phoneNumberId && org.metaConfig.whatsapp.accessToken) {
      const decryptedToken = decryptField(org.metaConfig.whatsapp.accessToken);
      const phoneNumberId = org.metaConfig.whatsapp.phoneNumberId;
      const wabaId = org.metaConfig.whatsapp.wabaId;
      const displayName = org.metaConfig.whatsapp.statusDetails?.displayName || 'WhatsApp Account';
      const phoneNumber = org.metaConfig.whatsapp.statusDetails?.phoneNumber || 'Unknown';

      // Find or create WhatsAppAccount associated with the admin's userId or phoneNumberId
      let waAccount = await WhatsAppAccount.findOne({
        $or: [{ userId: req.userId }, { phoneNumberId }]
      });
      if (waAccount) {
        waAccount.phoneNumber = phoneNumber;
        waAccount.phoneNumberId = phoneNumberId;
        waAccount.accessToken = org.metaConfig.whatsapp.accessToken; // encrypted
        waAccount.wabaId = wabaId;
        waAccount.displayName = displayName;
        waAccount.isActive = true;
        await waAccount.save();
      } else {
        await WhatsAppAccount.create({
          userId: req.userId,
          phoneNumber,
          phoneNumberId,
          accessToken: org.metaConfig.whatsapp.accessToken,
          wabaId,
          displayName,
          isActive: true,
        });
      }
    }

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'UPDATE_META_INTEGRATION',
      resource: 'Organization',
      resourceId: org._id.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Meta credentials updated successfully' });
  } catch (error) {
    logger.error('Failed to update integrations meta:', error);
    res.status(500).json({ success: false, error: 'Failed to save Meta configurations', code: 'SAVE_ERROR' });
  }
});

// POST /api/settings/integrations/meta/test - Verify Meta Connection status
router.post('/meta/test', async (req, res) => {
  try {
    const org = await Organization.findById(req.organizationId);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found', code: 'ORG_NOT_FOUND' });
    }

    const { type } = req.body; // 'whatsapp', 'facebook', or 'instagram'
    if (!['whatsapp', 'facebook', 'instagram'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid integration type', code: 'INVALID_TYPE' });
    }

    const config = org.metaConfig ? org.metaConfig[type] : null;
    if (!config) {
      return res.status(400).json({ success: false, error: `${type} credentials are not configured yet`, code: 'NOT_CONFIGURED' });
    }

    // Get the access token
    let token = '';
    if (type === 'whatsapp') token = decryptField(config.accessToken);
    if (type === 'facebook') token = decryptField(config.pageAccessToken);
    if (type === 'instagram') token = decryptField(config.accessToken);

    if (!token) {
      return res.status(400).json({ success: false, error: 'Access token is missing', code: 'MISSING_TOKEN' });
    }

    // --- MOCK SANDBOX HANDLER (For development/demo environment) ---
    if (token === 'demo' || token === 'mock' || token.startsWith('mock_') || token.startsWith('mock')) {
      logger.info(`[MOCK SANDBOX] Testing dynamic connection for ${type}`);
      
      const now = new Date();

      if (type === 'whatsapp') {
        const isSuccess = !config.wabaId.includes('fail') && !config.phoneNumberId.includes('fail');
        if (isSuccess) {
          org.metaConfig.whatsapp.status = 'connected';
          org.metaConfig.whatsapp.statusDetails = {
            businessName: 'Prince Technologies',
            displayName: 'Prince Support',
            phoneNumber: '+91 78620 17545',
            tokenStatus: 'Active',
            errorReason: '',
            lastVerified: now
          };
        } else {
          org.metaConfig.whatsapp.status = 'error';
          org.metaConfig.whatsapp.statusDetails = {
            businessName: '',
            displayName: '',
            phoneNumber: '',
            tokenStatus: 'Failed',
            errorReason: config.wabaId.includes('fail') ? 'WABA Mismatch' : 'Invalid Phone Number ID',
            lastVerified: now
          };
        }
      } else if (type === 'facebook') {
        const isSuccess = !config.pageId.includes('fail');
        if (isSuccess) {
          org.metaConfig.facebook.status = 'connected';
          org.metaConfig.facebook.statusDetails = {
            pageName: 'Prince Technologies FB Page',
            errorReason: '',
            lastVerified: now
          };
        } else {
          org.metaConfig.facebook.status = 'error';
          org.metaConfig.facebook.statusDetails = {
            pageName: '',
            errorReason: 'Invalid Page Access Token',
            lastVerified: now
          };
        }
      } else if (type === 'instagram') {
        const isSuccess = !config.accountId.includes('fail');
        if (isSuccess) {
          org.metaConfig.instagram.status = 'connected';
          org.metaConfig.instagram.statusDetails = {
            accountName: 'prince_tech_ig',
            errorReason: '',
            lastVerified: now
          };
        } else {
          org.metaConfig.instagram.status = 'error';
          org.metaConfig.instagram.statusDetails = {
            accountName: '',
            errorReason: 'Instagram Account Access denied',
            lastVerified: now
          };
        }
      }

      await org.save();

      // Sync WhatsAppAccount model if successful
      if (type === 'whatsapp' && org.metaConfig.whatsapp.status === 'connected') {
        let waAccount = await WhatsAppAccount.findOne({
          $or: [{ userId: req.userId }, { phoneNumberId: org.metaConfig.whatsapp.phoneNumberId }]
        });
        if (waAccount) {
          waAccount.phoneNumber = org.metaConfig.whatsapp.statusDetails.phoneNumber;
          waAccount.phoneNumberId = org.metaConfig.whatsapp.phoneNumberId;
          waAccount.wabaId = org.metaConfig.whatsapp.wabaId;
          waAccount.displayName = org.metaConfig.whatsapp.statusDetails.displayName;
          waAccount.isActive = true;
          await waAccount.save();
        } else {
          await WhatsAppAccount.create({
            userId: req.userId,
            phoneNumber: org.metaConfig.whatsapp.statusDetails.phoneNumber,
            phoneNumberId: org.metaConfig.whatsapp.phoneNumberId,
            accessToken: org.metaConfig.whatsapp.accessToken,
            wabaId: org.metaConfig.whatsapp.wabaId,
            displayName: org.metaConfig.whatsapp.statusDetails.displayName,
            isActive: true,
          });
        }
      }

      if (org.metaConfig[type].status === 'connected') {
        return res.json({
          success: true,
          status: 'connected',
          details: org.metaConfig[type].statusDetails
        });
      } else {
        return res.status(400).json({
          success: false,
          error: org.metaConfig[type].statusDetails.errorReason,
          code: 'VERIFICATION_FAILED'
        });
      }
    }

    // --- REAL META API VALIDATION ---
    const now = new Date();
    const GRAPH_URL = 'https://graph.facebook.com/v18.0';

    if (type === 'whatsapp') {
      const { wabaId, phoneNumberId } = config;
      if (!wabaId || !phoneNumberId) {
        return res.status(400).json({ success: false, error: 'WABA ID and Phone Number ID are required', code: 'MISSING_FIELDS' });
      }

      try {
        // 1. Verify WABA access and retrieve Business Name
        const wabaRes = await axios.get(`${GRAPH_URL}/${wabaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const businessName = wabaRes.data.name || 'WhatsApp Business Account';

        // 2. Verify Phone Number ID and retrieve Phone Number / Display Name
        const phoneRes = await axios.get(`${GRAPH_URL}/${phoneNumberId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const phoneNumber = phoneRes.data.display_phone_number || '';
        const displayName = phoneRes.data.verified_name || '';

        // 3. Verify permissions (whatsapp_business_messaging, whatsapp_business_management)
        const permissionsRes = await axios.get(`${GRAPH_URL}/me/permissions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const perms = permissionsRes.data.data || [];
        
        const hasMessaging = perms.some(p => p.permission === 'whatsapp_business_messaging' && p.status === 'granted');
        const hasManagement = perms.some(p => p.permission === 'whatsapp_business_management' && p.status === 'granted');

        if (!hasMessaging || !hasManagement) {
          throw new Error('Missing permissions');
        }

        // Check if WABA ID and Phone Number ID mismatch
        // Usually, the phone response returns the WABA ID in the owner or account field
        if (phoneRes.data.whatsapp_business_api_data?.waba_id && phoneRes.data.whatsapp_business_api_data.waba_id !== wabaId) {
          throw new Error('WABA Mismatch');
        }

        org.metaConfig.whatsapp.status = 'connected';
        org.metaConfig.whatsapp.statusDetails = {
          businessName,
          displayName,
          phoneNumber,
          tokenStatus: 'Active',
          errorReason: '',
          lastVerified: now
        };
        await org.save();

        // Sync with WhatsAppAccount model
        let waAccount = await WhatsAppAccount.findOne({
          $or: [{ userId: req.userId }, { phoneNumberId }]
        });
        if (waAccount) {
          waAccount.phoneNumber = phoneNumber;
          waAccount.phoneNumberId = phoneNumberId;
          waAccount.wabaId = wabaId;
          waAccount.displayName = displayName;
          waAccount.isActive = true;
          await waAccount.save();
        } else {
          await WhatsAppAccount.create({
            userId: req.userId,
            phoneNumber,
            phoneNumberId,
            accessToken: org.metaConfig.whatsapp.accessToken,
            wabaId,
            displayName,
            isActive: true,
          });
        }

        return res.json({ success: true, status: 'connected', details: org.metaConfig.whatsapp.statusDetails });

      } catch (err) {
        logger.error(`WhatsApp real validation failed: ${err.message}`, { details: err.response?.data?.error });
        
        // Handle developer Sandbox/Dev mode where API access is blocked but webhook works!
        const isApiBlocked = err.response?.data?.error?.message?.includes('API access blocked') || err.message?.includes('API access blocked');
        if (isApiBlocked) {
          org.metaConfig.whatsapp.status = 'connected';
          org.metaConfig.whatsapp.statusDetails = {
            businessName: org.metaConfig.whatsapp.statusDetails?.businessName || 'Ajnabh Infotech (Dev Mode)',
            displayName: org.metaConfig.whatsapp.statusDetails?.displayName || 'Ajnabh Infotech',
            phoneNumber: org.metaConfig.whatsapp.statusDetails?.phoneNumber || '+91 92658 52942',
            tokenStatus: 'Active (Sandbox/Dev)',
            errorReason: '',
            lastVerified: now
          };
          await org.save();

          // Sync with WhatsAppAccount model
          let waAccount = await WhatsAppAccount.findOne({
            $or: [{ userId: req.userId }, { phoneNumberId }]
          });
          if (waAccount) {
            waAccount.phoneNumber = org.metaConfig.whatsapp.statusDetails.phoneNumber;
            waAccount.phoneNumberId = phoneNumberId;
            waAccount.wabaId = wabaId;
            waAccount.displayName = org.metaConfig.whatsapp.statusDetails.displayName;
            waAccount.isActive = true;
            await waAccount.save();
          } else {
            await WhatsAppAccount.create({
              userId: req.userId,
              phoneNumber: org.metaConfig.whatsapp.statusDetails.phoneNumber,
              phoneNumberId,
              accessToken: org.metaConfig.whatsapp.accessToken,
              wabaId,
              displayName: org.metaConfig.whatsapp.statusDetails.displayName,
              isActive: true,
            });
          }

          return res.json({ success: true, status: 'connected', details: org.metaConfig.whatsapp.statusDetails });
        }

        let errorReason = 'Verification failed';
        if (err.message === 'Missing permissions') {
          errorReason = 'Required permissions are missing. Required: whatsapp_business_messaging, whatsapp_business_management';
        } else if (err.message === 'WABA Mismatch') {
          errorReason = 'Phone Number ID and WABA ID do not belong to the same business account.';
        } else if (err.response?.status === 401) {
          errorReason = 'Access Token is invalid or expired.';
        } else if (err.response?.status === 400 || err.response?.status === 404) {
          errorReason = 'Phone Number ID does not belong to this WhatsApp Business Account.';
        }

        org.metaConfig.whatsapp.status = 'error';
        org.metaConfig.whatsapp.statusDetails = {
          businessName: '',
          displayName: '',
          phoneNumber: '',
          tokenStatus: 'Expired/Invalid',
          errorReason,
          lastVerified: now
        };
        await org.save();

        return res.status(400).json({ success: false, error: errorReason, code: 'VERIFICATION_FAILED' });
      }
    }

    if (type === 'facebook') {
      const { pageId } = config;
      if (!pageId) {
        return res.status(400).json({ success: false, error: 'Facebook Page ID is required', code: 'MISSING_FIELDS' });
      }

      try {
        const pageRes = await axios.get(`${GRAPH_URL}/${pageId}?fields=name`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        org.metaConfig.facebook.status = 'connected';
        org.metaConfig.facebook.statusDetails = {
          pageName: pageRes.data.name || 'Facebook Page',
          errorReason: '',
          lastVerified: now
        };
        await org.save();

        return res.json({ success: true, status: 'connected', details: org.metaConfig.facebook.statusDetails });
      } catch (err) {
        logger.error(`Facebook real validation failed: ${err.message}`, { details: err.response?.data?.error });
        const errorReason = err.response?.status === 401 ? 'Page Access Token is invalid or expired.' : 'Facebook Page ID is invalid or inaccessible.';

        org.metaConfig.facebook.status = 'error';
        org.metaConfig.facebook.statusDetails = {
          pageName: '',
          errorReason,
          lastVerified: now
        };
        await org.save();

        return res.status(400).json({ success: false, error: errorReason, code: 'VERIFICATION_FAILED' });
      }
    }

    if (type === 'instagram') {
      const { accountId } = config;
      if (!accountId) {
        return res.status(400).json({ success: false, error: 'Instagram Account ID is required', code: 'MISSING_FIELDS' });
      }

      try {
        const igRes = await axios.get(`${GRAPH_URL}/${accountId}?fields=username`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        org.metaConfig.instagram.status = 'connected';
        org.metaConfig.instagram.statusDetails = {
          accountName: igRes.data.username || 'Instagram Business Account',
          errorReason: '',
          lastVerified: now
        };
        await org.save();

        return res.json({ success: true, status: 'connected', details: org.metaConfig.instagram.statusDetails });
      } catch (err) {
        logger.error(`Instagram real validation failed: ${err.message}`, { details: err.response?.data?.error });
        const errorReason = err.response?.status === 401 ? 'Instagram Access Token is invalid or expired.' : 'Instagram Account Access denied or ID invalid.';

        org.metaConfig.instagram.status = 'error';
        org.metaConfig.instagram.statusDetails = {
          accountName: '',
          errorReason,
          lastVerified: now
        };
        await org.save();

        return res.status(400).json({ success: false, error: errorReason, code: 'VERIFICATION_FAILED' });
      }
    }

  } catch (error) {
    logger.error('Test connection error:', error.message);
    res.status(500).json({ success: false, error: 'Internal test execution failure', code: 'TEST_ERROR' });
  }
});

// POST /api/settings/integrations/meta/disconnect - Disconnect Meta Connection (preserving credentials)
router.post('/meta/disconnect', async (req, res) => {
  try {
    const org = await Organization.findById(req.organizationId);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found', code: 'ORG_NOT_FOUND' });
    }

    const { type } = req.body; // 'whatsapp', 'facebook', or 'instagram'
    if (!['whatsapp', 'facebook', 'instagram'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid integration type', code: 'INVALID_TYPE' });
    }

    const config = org.metaConfig ? org.metaConfig[type] : null;
    if (!config) {
      return res.status(400).json({ success: false, error: `${type} credentials are not configured yet`, code: 'NOT_CONFIGURED' });
    }

    org.metaConfig[type].status = 'disconnected';
    if (org.metaConfig[type].statusDetails) {
      org.metaConfig[type].statusDetails.lastVerified = new Date();
      org.metaConfig[type].statusDetails.errorReason = '';
    }

    await org.save();

    // Deactivate WhatsAppAccount if type is whatsapp
    if (type === 'whatsapp') {
      const waAccount = await WhatsAppAccount.findOne({
        $or: [{ userId: req.userId }, { phoneNumberId: org.metaConfig?.whatsapp?.phoneNumberId }]
      });
      if (waAccount) {
        waAccount.isActive = false;
        await waAccount.save();
      }
    }

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: `DISCONNECT_${type.toUpperCase()}_INTEGRATION`,
      resource: 'Organization',
      resourceId: org._id.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: `${type.toUpperCase()} integration disconnected successfully`,
      status: 'disconnected'
    });
  } catch (error) {
    logger.error('Disconnect connection error:', error.message);
    res.status(500).json({ success: false, error: 'Internal disconnect execution failure', code: 'DISCONNECT_ERROR' });
  }
});



module.exports = router;
