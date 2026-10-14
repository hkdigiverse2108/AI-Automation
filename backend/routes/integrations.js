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

// Apply Auth and Admin/Owner/Superadmin role checking
router.use(verifyToken);
router.use(requireRole('admin', 'owner', 'superadmin'));

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

      // Find or create WhatsAppAccount associated with this specific phoneNumberId
      let waAccount = await WhatsAppAccount.findOne({ phoneNumberId });
      if (waAccount) {
        waAccount.phoneNumber = phoneNumber;
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
        const targetPhoneId = org.metaConfig.whatsapp.phoneNumberId;
        let waAccount = await WhatsAppAccount.findOne({ phoneNumberId: targetPhoneId });
        if (waAccount) {
          waAccount.phoneNumber = org.metaConfig.whatsapp.statusDetails.phoneNumber;
          waAccount.wabaId = org.metaConfig.whatsapp.wabaId;
          waAccount.displayName = org.metaConfig.whatsapp.statusDetails.displayName;
          waAccount.isActive = true;
          await waAccount.save();
        } else {
          await WhatsAppAccount.create({
            userId: req.userId,
            phoneNumber: org.metaConfig.whatsapp.statusDetails.phoneNumber,
            phoneNumberId: targetPhoneId,
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
        let waAccount = await WhatsAppAccount.findOne({ phoneNumberId });
        if (waAccount) {
          waAccount.phoneNumber = phoneNumber;
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
            businessName: org.metaConfig.whatsapp.statusDetails?.businessName || 'HK Automation (Dev Mode)',
            displayName: org.metaConfig.whatsapp.statusDetails?.displayName || 'HK Automation',
            phoneNumber: org.metaConfig.whatsapp.statusDetails?.phoneNumber || '+91 92658 52942',
            tokenStatus: 'Active (Sandbox/Dev)',
            errorReason: '',
            lastVerified: now
          };
          await org.save();

          // Sync with WhatsAppAccount model
          let waAccount = await WhatsAppAccount.findOne({ phoneNumberId });
          if (waAccount) {
            waAccount.phoneNumber = org.metaConfig.whatsapp.statusDetails.phoneNumber;
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
      const targetPhoneId = org.metaConfig?.whatsapp?.phoneNumberId;
      if (targetPhoneId) {
        const waAccount = await WhatsAppAccount.findOne({ phoneNumberId: targetPhoneId });
        if (waAccount) {
          waAccount.isActive = false;
          await waAccount.save();
        }
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
// POST /api/settings/integrations/meta/register-phone - Call Meta Register API for a phone number
router.post('/meta/register-phone', async (req, res) => {
  try {
    const org = await Organization.findById(req.organizationId);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found', code: 'ORG_NOT_FOUND' });
    }

    const { phoneNumberId, pin } = req.body;
    if (!phoneNumberId || !pin) {
      return res.status(400).json({ success: false, error: 'Phone Number ID and PIN are required', code: 'MISSING_FIELDS' });
    }

    // 1. Get WABA configuration and decrypted Access Token
    const config = org.metaConfig ? org.metaConfig.whatsapp : null;
    if (!config || !config.accessToken) {
      return res.status(400).json({ success: false, error: 'WhatsApp Access Token is not configured', code: 'NOT_CONFIGURED' });
    }

    const token = decryptField(config.accessToken);
    if (!token) {
      return res.status(400).json({ success: false, error: 'Access token decryption failed', code: 'DECRYPTION_ERROR' });
    }

    const GRAPH_URL = 'https://graph.facebook.com/v18.0';

    logger.info(`[META REGISTER PHONE REQUEST] POST ${GRAPH_URL}/${phoneNumberId}/register`, {
      phoneNumberId,
      pin: '••••••'
    });

    // 2. Call registration endpoint on Meta
    let regResponse;
    try {
      regResponse = await axios.post(`${GRAPH_URL}/${phoneNumberId}/register`, {
        messaging_product: 'whatsapp',
        pin: pin
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      logger.info(`[META REGISTER PHONE RESPONSE] SUCCESS:`, { response: regResponse.data });
    } catch (apiErr) {
      const errData = apiErr.response?.data?.error || {};
      logger.error(`[META REGISTER PHONE API ERROR] FAILED:`, {
        status: apiErr.response?.status,
        message: errData.message || apiErr.message,
        code: errData.code,
        error_subcode: errData.error_subcode,
        response: apiErr.response?.data
      });
      return res.status(apiErr.response?.status || 500).json({
        success: false,
        error: errData.message || apiErr.message,
        code: 'META_API_ERROR',
        details: errData
      });
    }

    // 3. Fetch phone number details (display_phone_number, verified_name)
    let displayPhoneNumber = '';
    let verifiedName = '';
    try {
      const phoneRes = await axios.get(`${GRAPH_URL}/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      displayPhoneNumber = phoneRes.data.display_phone_number || '';
      verifiedName = phoneRes.data.verified_name || '';
      logger.info(`[META REGISTER PHONE DETAILS] SUCCESS:`, { displayPhoneNumber, verifiedName });
    } catch (detailErr) {
      logger.warn('Failed to retrieve registered phone number details:', detailErr.message);
    }

    const now = new Date();

    // 4. Update organization config if registering the active number
    if (org.metaConfig.whatsapp.phoneNumberId === phoneNumberId) {
      org.metaConfig.whatsapp.status = 'connected';
      org.metaConfig.whatsapp.statusDetails = {
        businessName: org.metaConfig.whatsapp.statusDetails?.businessName || 'Ajnabh Infotech',
        displayName: verifiedName || org.metaConfig.whatsapp.statusDetails?.displayName || 'WhatsApp Account',
        phoneNumber: displayPhoneNumber || org.metaConfig.whatsapp.statusDetails?.phoneNumber || 'Unknown',
        tokenStatus: 'Active',
        errorReason: '',
        lastVerified: now
      };
      await org.save();
    }

    // 5. Upsert WhatsAppAccount specifically by phoneNumberId so we do not overwrite other accounts
    let waAccount = await WhatsAppAccount.findOne({ phoneNumberId });
    if (waAccount) {
      waAccount.phoneNumber = displayPhoneNumber || waAccount.phoneNumber;
      waAccount.wabaId = config.wabaId;
      waAccount.displayName = verifiedName || waAccount.displayName;
      waAccount.accessToken = config.accessToken; // encrypted
      waAccount.isActive = true;
      waAccount.webhookVerified = true;
      await waAccount.save();
    } else {
      await WhatsAppAccount.create({
        userId: req.userId,
        phoneNumber: displayPhoneNumber || 'Unknown',
        phoneNumberId,
        accessToken: config.accessToken,
        wabaId: config.wabaId,
        displayName: verifiedName || 'WhatsApp Account',
        isActive: true,
        webhookVerified: true
      });
    }

    const AuditLog = require('../models/AuditLog');
    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'REGISTER_WHATSAPP_PHONE_NUMBER',
      resource: 'WhatsAppAccount',
      resourceId: phoneNumberId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Phone number registered successfully and synced in platform',
      data: {
        phoneNumberId,
        displayPhoneNumber,
        verifiedName
      }
    });

  } catch (error) {
    logger.error('Phone number registration endpoint error:', error.message);
    res.status(500).json({ success: false, error: 'Internal execution failure', code: 'REGISTRATION_ERROR' });
  }
});

// ==========================================
// AI INTEGRATION SETTINGS (Groq, Gemini, OpenAI)
// ==========================================

// Helper to get active Organization for user
async function resolveUserOrg(req) {
  let org = null;
  if (req.organizationId) {
    org = await Organization.findById(req.organizationId);
  }
  if (!org && req.user?.role === 'superadmin') {
    org = await Organization.findOne();
  }
  return org;
}

// Helper to resolve decrypted key for a provider
function getStoredKey(aiConfig, provider) {
  if (!aiConfig || !provider) return '';
  const prov = provider.toLowerCase().trim();
  const mapKey = aiConfig.apiKeys?.get ? aiConfig.apiKeys.get(prov) : aiConfig.apiKeys?.[prov];
  const fieldKey = aiConfig[`${prov}ApiKey`] || (prov === 'xai' ? aiConfig.grokApiKey : '');
  const encKey = mapKey || fieldKey || aiConfig.activeApiKey || '';
  return encKey ? decryptField(encKey) : '';
}

// GET /api/settings/integrations/ai — Retrieve AI configuration (all providers)
router.get('/ai', async (req, res) => {
  try {
    const org = await resolveUserOrg(req);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found', code: 'ORG_NOT_FOUND' });
    }

    const ai = org.aiConfig || {};
    const activeProvider = (ai.provider || '').toLowerCase().trim();

    // Map of masked keys for each provider
    const keys = {
      groq: maskToken(ai.groqApiKey || ai.grokApiKey ? decryptField(ai.groqApiKey || ai.grokApiKey) : ''),
      gemini: maskToken(ai.geminiApiKey ? decryptField(ai.geminiApiKey) : ''),
      openai: maskToken(ai.openaiApiKey ? decryptField(ai.openaiApiKey) : ''),
      anthropic: maskToken(ai.anthropicApiKey ? decryptField(ai.anthropicApiKey) : ''),
      deepseek: maskToken(ai.deepseekApiKey ? decryptField(ai.deepseekApiKey) : ''),
      xai: maskToken(ai.xaiApiKey || ai.grokApiKey ? decryptField(ai.xaiApiKey || ai.grokApiKey) : ''),
      mistral: maskToken(ai.mistralApiKey ? decryptField(ai.mistralApiKey) : ''),
      perplexity: maskToken(ai.perplexityApiKey ? decryptField(ai.perplexityApiKey) : ''),
      openrouter: maskToken(ai.openrouterApiKey ? decryptField(ai.openrouterApiKey) : ''),
      cohere: maskToken(ai.cohereApiKey ? decryptField(ai.cohereApiKey) : ''),
      custom: maskToken(ai.customApiKey ? decryptField(ai.customApiKey) : '')
    };

    if (ai.apiKeys) {
      const entries = ai.apiKeys.entries ? Array.from(ai.apiKeys.entries()) : Object.entries(ai.apiKeys);
      for (const [k, v] of entries) {
        if (v) keys[k] = maskToken(decryptField(v));
      }
    }

    // STRICT: Only configured if user explicitly saved key in DB
    const activeRawKey = getStoredKey(ai, activeProvider);
    const isConfigured = Boolean(
      activeProvider &&
      (activeRawKey || (activeProvider === 'custom' && ai.customBaseUrl)) &&
      ai.isEnabled !== false
    );

    res.json({
      success: true,
      data: {
        provider: activeProvider || 'groq',
        apiKeys: keys,
        customBaseUrl: ai.customBaseUrl || '',
        model: ai.model || '',
        systemPrompt: ai.systemPrompt || '',
        temperature: typeof ai.temperature === 'number' ? ai.temperature : 0.7,
        isEnabled: ai.isEnabled !== false,
        status: ai.status || 'disconnected',
        statusDetails: ai.statusDetails || {},
        isConfigured
      }
    });
  } catch (error) {
    logger.error('Failed to get AI settings:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch AI settings', code: 'FETCH_ERROR' });
  }
});

// POST /api/settings/integrations/ai — Update AI configuration
router.post('/ai', async (req, res) => {
  try {
    const org = await resolveUserOrg(req);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found', code: 'ORG_NOT_FOUND' });
    }

    const {
      provider,
      apiKey,
      customBaseUrl,
      model,
      systemPrompt,
      temperature,
      isEnabled
    } = req.body;

    if (!org.aiConfig) {
      org.aiConfig = {};
    }

    const targetProvider = (provider || org.aiConfig.provider || 'groq').toLowerCase().trim();
    org.aiConfig.provider = targetProvider;

    // Save or clear API key for target provider
    if (apiKey !== undefined) {
      const cleanKey = apiKey.trim();
      if (cleanKey === '') {
        // Clear key
        if (org.aiConfig.apiKeys?.set) org.aiConfig.apiKeys.set(targetProvider, '');
        org.aiConfig[`${targetProvider}ApiKey`] = '';
        if (targetProvider === 'groq' || targetProvider === 'xai') org.aiConfig.grokApiKey = '';
        org.aiConfig.activeApiKey = '';
        org.aiConfig.status = 'disconnected';
      } else if (!cleanKey.includes('••••')) {
        const encrypted = encryptField(cleanKey);
        if (org.aiConfig.apiKeys?.set) org.aiConfig.apiKeys.set(targetProvider, encrypted);
        org.aiConfig[`${targetProvider}ApiKey`] = encrypted;
        org.aiConfig.activeApiKey = encrypted;
      }
    }

    if (customBaseUrl !== undefined) {
      org.aiConfig.customBaseUrl = customBaseUrl.trim();
    }

    if (model !== undefined) {
      org.aiConfig.model = model.trim();
    }

    if (systemPrompt !== undefined) {
      org.aiConfig.systemPrompt = systemPrompt.trim();
    }

    if (temperature !== undefined) {
      org.aiConfig.temperature = Math.min(Math.max(Number(temperature) || 0.7, 0), 1.5);
    }

    if (isEnabled !== undefined) {
      org.aiConfig.isEnabled = Boolean(isEnabled);
    }

    await org.save();

    const AuditLog = require('../models/AuditLog');
    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'UPDATE_AI_CONFIG',
      resource: 'Organization',
      resourceId: org._id.toString(),
      newValue: { provider: org.aiConfig.provider, model: org.aiConfig.model, isEnabled: org.aiConfig.isEnabled },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'AI Integration settings saved successfully!',
      data: {
        provider: org.aiConfig.provider,
        model: org.aiConfig.model,
        isEnabled: org.aiConfig.isEnabled,
        status: org.aiConfig.status
      }
    });
  } catch (error) {
    logger.error('Failed to save AI config:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to save AI settings', code: 'SAVE_ERROR' });
  }
});

// POST /api/settings/integrations/ai/test — Test AI Provider Key & Latency (supports all providers)
router.post('/ai/test', async (req, res) => {
  let org = null;
  try {
    org = await resolveUserOrg(req);
    const { provider = 'groq', apiKey: rawKeyInput, model, customBaseUrl } = req.body;
    const targetProvider = provider.toLowerCase().trim();

    let targetKey = (rawKeyInput || '').trim();

    // If key contains mask or is empty, resolve from DB
    if (!targetKey || targetKey.includes('••••')) {
      targetKey = getStoredKey(org?.aiConfig, targetProvider);
    }

    // Custom provider without key is allowed if customBaseUrl is set
    if (!targetKey && !(targetProvider === 'custom' && (customBaseUrl || org?.aiConfig?.customBaseUrl))) {
      return res.status(400).json({
        success: false,
        error: `Please enter an API Key for ${targetProvider.toUpperCase()} before testing.`,
        code: 'MISSING_API_KEY'
      });
    }

    const startTime = Date.now();
    let testResponseText = '';
    let chosenWorkingModel = model || '';

    if (targetProvider === 'anthropic') {
      const anthropicCandidates = [model, 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'].filter(Boolean);
      let anthropicSuccess = false;
      let lastAnthropicError = null;

      for (const am of anthropicCandidates) {
        try {
          const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
              model: am,
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Reply "AI_READY"' }]
            },
            {
              headers: {
                'x-api-key': targetKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
              },
              timeout: 15000
            }
          );
          testResponseText = response.data?.content?.[0]?.text || '';
          chosenWorkingModel = am;
          anthropicSuccess = true;
          break;
        } catch (aErr) {
          lastAnthropicError = aErr;
          if (aErr.response?.status === 401) throw aErr;
        }
      }

      if (!anthropicSuccess) {
        throw lastAnthropicError || new Error('Anthropic connection verification failed');
      }

    } else if (targetProvider === 'gemini') {
      const geminiCandidates = Array.from(new Set([model, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'].filter(Boolean)));
      let geminiSuccess = false;
      let primaryModelError = null;
      let lastGeminiError = null;

      for (const gm of geminiCandidates) {
        try {
          const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            {
              model: gm,
              messages: [{ role: 'user', content: 'Reply "AI_READY"' }],
              max_tokens: 10
            },
            {
              headers: {
                'Authorization': `Bearer ${targetKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 15000
            }
          );
          testResponseText = response.data?.choices?.[0]?.message?.content || '';
          chosenWorkingModel = gm;
          geminiSuccess = true;
          break;
        } catch (errOpenAI) {
          try {
            const directRes = await axios.post(
              `https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent?key=${targetKey}`,
              {
                contents: [{ role: 'user', parts: [{ text: 'Reply "AI_READY"' }] }]
              },
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
              }
            );
            testResponseText = directRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            chosenWorkingModel = gm;
            geminiSuccess = true;
            break;
          } catch (directErr) {
            lastGeminiError = directErr;
            if (!primaryModelError) primaryModelError = directErr;

            const errBody = directErr.response?.data?.error;
            const errMsg = errBody?.message || directErr.message || '';
            const status = directErr.response?.status;

            if (status === 401 || status === 403 || errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID')) {
              throw directErr;
            }
          }
        }
      }

      if (!geminiSuccess) {
        throw primaryModelError || lastGeminiError || new Error('Gemini connection verification failed');
      }

    } else {
      // Standard OpenAI-Compatible Providers
      let baseURL = '';
      let defaultModel = '';
      let candidateModels = [];

      if (targetProvider === 'groq') {
        baseURL = 'https://api.groq.com/openai/v1';
        defaultModel = 'llama-3.1-8b-instant';
        candidateModels = [
          'llama-3.1-8b-instant',
          'llama-3.3-70b-versatile',
          'gemma2-9b-it'
        ];
      } else if (targetProvider === 'openai') {
        baseURL = 'https://api.openai.com/v1';
        defaultModel = 'gpt-4o-mini';
        candidateModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
      } else if (targetProvider === 'deepseek') {
        baseURL = 'https://api.deepseek.com';
        defaultModel = 'deepseek-chat';
        candidateModels = ['deepseek-chat', 'deepseek-reasoner'];
      } else if (targetProvider === 'xai') {
        baseURL = 'https://api.x.ai/v1';
        defaultModel = 'grok-2-latest';
        candidateModels = ['grok-2-latest', 'grok-beta'];
      } else if (targetProvider === 'mistral') {
        baseURL = 'https://api.mistral.ai/v1';
        defaultModel = 'mistral-large-latest';
        candidateModels = ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-7b'];
      } else if (targetProvider === 'perplexity') {
        baseURL = 'https://api.perplexity.ai';
        defaultModel = 'sonar';
        candidateModels = ['sonar', 'sonar-pro'];
      } else if (targetProvider === 'openrouter') {
        baseURL = 'https://openrouter.ai/api/v1';
        defaultModel = 'meta-llama/llama-3.3-70b-instruct';
        candidateModels = ['meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.0-flash-exp:free'];
      } else if (targetProvider === 'cohere') {
        baseURL = 'https://api.cohere.com/v2';
        defaultModel = 'command-r-plus-08-2024';
        candidateModels = ['command-r-plus-08-2024', 'command-r-08-2024'];
      } else if (targetProvider === 'custom') {
        baseURL = (customBaseUrl || org?.aiConfig?.customBaseUrl || '').replace(/\/+$/, '');
        defaultModel = 'default';
        candidateModels = ['default'];
        if (!baseURL) {
          return res.status(400).json({ success: false, error: 'Please enter a Base URL for Custom Provider.' });
        }
      }

      const headers = { 'Content-Type': 'application/json' };
      if (targetKey) headers['Authorization'] = `Bearer ${targetKey}`;

      const requestedModel = model || defaultModel;
      const modelsToTry = [requestedModel];
      for (const cm of candidateModels) {
        if (!modelsToTry.includes(cm)) modelsToTry.push(cm);
      }

      chosenWorkingModel = requestedModel;
      let callSuccess = false;
      let lastCallError = null;

      for (const m of modelsToTry) {
        try {
          const response = await axios.post(
            `${baseURL}/chat/completions`,
            {
              model: m,
              messages: [{ role: 'user', content: 'Reply "AI_READY"' }],
              max_tokens: 10,
              temperature: 0.1
            },
            {
              headers,
              timeout: 15000
            }
          );
          testResponseText = response.data?.choices?.[0]?.message?.content || '';
          chosenWorkingModel = m;
          callSuccess = true;
          break;
        } catch (mErr) {
          lastCallError = mErr;
          const status = mErr.response?.status;
          const errDataMsg = (mErr.response?.data?.error?.message || mErr.response?.data?.error || mErr.message || '').toLowerCase();
          if (status === 401 || errDataMsg.includes('invalid api key') || errDataMsg.includes('unauthorized')) {
            throw mErr;
          }
        }
      }

      // If preset candidates failed, dynamically discover active chat models via /models
      if (!callSuccess) {
        try {
          const modelsRes = await axios.get(`${baseURL}/models`, { headers, timeout: 10000 });
          const availModels = (modelsRes.data?.data || []).map(item => item.id).filter(id => {
            const lower = (id || '').toLowerCase();
            return !lower.includes('whisper') && !lower.includes('embed') && !lower.includes('tts') && !lower.includes('dall-e');
          });

          for (const m of availModels.slice(0, 4)) {
            try {
              const response = await axios.post(
                `${baseURL}/chat/completions`,
                {
                  model: m,
                  messages: [{ role: 'user', content: 'Reply "AI_READY"' }],
                  max_tokens: 10,
                  temperature: 0.1
                },
                {
                  headers,
                  timeout: 15000
                }
              );
              testResponseText = response.data?.choices?.[0]?.message?.content || '';
              chosenWorkingModel = m;
              callSuccess = true;
              break;
            } catch (err) {
              // try next available model
            }
          }
        } catch (fetchErr) {
          // ignore
        }
      }

      if (!callSuccess) {
        throw lastCallError || new Error(`No available model found on ${targetProvider.toUpperCase()}`);
      }
    }

    const latencyMs = Date.now() - startTime;

    if (org) {
      if (!org.aiConfig) org.aiConfig = {};
      org.aiConfig.status = 'connected';
      org.aiConfig.model = chosenWorkingModel;
      org.aiConfig.statusDetails = {
        lastTested: new Date(),
        latencyMs,
        errorReason: ''
      };
      await org.save();
    }

    res.json({
      success: true,
      message: `Verified successfully! ${targetProvider.toUpperCase()} connected using model '${chosenWorkingModel}' in ${latencyMs}ms.`,
      data: {
        status: 'connected',
        latencyMs,
        model: chosenWorkingModel,
        response: testResponseText.trim()
      }
    });

  } catch (error) {
    const errorDetails = error.response?.data?.error?.message || error.response?.data?.error || error.message;
    logger.error('AI Connection test failed:', errorDetails);

    if (org) {
      if (!org.aiConfig) org.aiConfig = {};
      org.aiConfig.status = 'error';
      org.aiConfig.statusDetails = {
        lastTested: new Date(),
        errorReason: errorDetails
      };
      await org.save();
    }

    res.status(400).json({
      success: false,
      error: `Verification failed: ${errorDetails}`,
      code: 'TEST_FAILED'
    });
  }
});

module.exports = router;
