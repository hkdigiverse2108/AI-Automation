const router = require('express').Router();
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/auth');
const { campaignValidation, validateObjectId } = require('../middleware/validator');
const queueService = require('../services/queueService');
const multer = require('multer');
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

router.use(verifyToken);
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
router.use(checkFeatureAccess('campaigns'));

// GET /campaigns
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 20, isUnofficial } = req.query;
    const query = { userId: req.userId };
    if (status) query.status = status;
    if (isUnofficial !== undefined) {
      query.isUnofficial = isUnofficial === 'true';
    } else {
      // Default to official campaigns if not specified
      query.isUnofficial = { $ne: true };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [campaigns, total] = await Promise.all([
      Campaign.find(query).populate('audience.groupIds', 'name').sort('-createdAt').skip(skip).limit(parseInt(limit)).lean(),
      Campaign.countDocuments(query),
    ]);

    res.json({ success: true, data: { campaigns, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch campaigns', code: 'FETCH_ERROR' });
  }
});

// POST /campaigns — create
router.post('/', campaignValidation, async (req, res) => {
  try {
    const { name, templateName, templateId, audience, variables, scheduledAt, headerMediaId, isUnofficial } = req.body;

    const campaign = await Campaign.create({
      userId: req.userId,
      name,
      templateName,
      templateId,
      audience: audience || { type: 'all' },
      variables: variables || [],
      headerMediaId,
      isUnofficial: !!isUnofficial,
      status: scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });
    
    if (campaign.audience?.groupIds?.length) {
      await campaign.populate('audience.groupIds', 'name');
    }

    res.status(201).json({ success: true, data: { campaign }, message: 'Campaign created' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create campaign', code: 'CREATE_ERROR' });
  }
});

// POST /campaigns/upload-image — upload file to Meta
router.post('/upload-image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded', code: 'MISSING_FILE' });
    }
    const WhatsAppAccount = require('../models/WhatsAppAccount');
    const whatsapp = require('../services/whatsapp');
    const { decryptField } = require('../services/encryption');

    const waAccount = await WhatsAppAccount.findOne({ userId: req.userId, isActive: true });
    if (!waAccount) {
      return res.status(400).json({ success: false, error: 'No active WhatsApp account connected', code: 'NO_WA_ACCOUNT' });
    }

    const token = decryptField(waAccount.accessToken);
    const result = await whatsapp.uploadMedia(waAccount.phoneNumberId, token, req.file.buffer, req.file.mimetype);

    if (result.success) {
      res.json({ success: true, mediaId: result.data.id });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Upload to Meta failed', code: 'UPLOAD_FAILED' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'UPLOAD_ERROR' });
  }
});

// POST /campaigns/:id/start
router.post('/:id/start', ...validateObjectId('id'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.userId });
    if (!campaign) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({ success: false, error: 'Campaign cannot be started', code: 'INVALID_STATUS' });
    }

    const result = await queueService.startCampaign(campaign._id, req.userId);

    await AuditLog.log({ userId: req.userId, action: 'START_CAMPAIGN', resource: 'Campaign', resourceId: req.params.id, ip: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true, data: result, message: 'Campaign started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to start campaign', code: 'START_ERROR' });
  }
});

// POST /campaigns/:id/pause
router.post('/:id/pause', ...validateObjectId('id'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.userId, status: 'running' });
    if (!campaign) return res.status(404).json({ success: false, error: 'Not found or not running', code: 'NOT_FOUND' });

    await queueService.pauseCampaign(campaign._id);
    res.json({ success: true, message: 'Campaign paused' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Pause failed', code: 'PAUSE_ERROR' });
  }
});

// POST /campaigns/:id/resume
router.post('/:id/resume', ...validateObjectId('id'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.userId, status: 'paused' });
    if (!campaign) return res.status(404).json({ success: false, error: 'Not found or not paused', code: 'NOT_FOUND' });

    await queueService.resumeCampaign(campaign._id);
    res.json({ success: true, message: 'Campaign resumed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Resume failed', code: 'RESUME_ERROR' });
  }
});

// GET /campaigns/:id/stats
router.get('/:id/stats', ...validateObjectId('id'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!campaign) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });

    const total = campaign.audience?.totalCount || 1;
    const stats = campaign.stats || {};

    res.json({
      success: true,
      data: {
        ...stats,
        totalCount: total,
        deliveryRate: total > 0 ? Math.round(((stats.delivered || 0) / total) * 100) : 0,
        readRate: total > 0 ? Math.round(((stats.read || 0) / total) * 100) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Stats fetch failed', code: 'STATS_ERROR' });
  }
});

// PUT /campaigns/:id — edit campaign details
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.userId });
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found', code: 'NOT_FOUND' });

    // Only allow editing drafts or scheduled campaigns
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({ success: false, error: 'Only drafts or scheduled campaigns can be edited', code: 'INVALID_STATUS' });
    }

    const { name, templateName, templateId, audience, variables, scheduledAt, headerMediaId } = req.body;

    if (name) campaign.name = name;
    if (templateName) campaign.templateName = templateName;
    if (templateId) campaign.templateId = templateId;
    if (audience) campaign.audience = audience;
    if (variables) campaign.variables = variables;
    if (headerMediaId !== undefined) campaign.headerMediaId = headerMediaId;
    
    if (scheduledAt !== undefined) {
      campaign.scheduledAt = scheduledAt ? new Date(scheduledAt) : undefined;
      campaign.status = scheduledAt ? 'scheduled' : 'draft';
    }

    await campaign.save();

    if (campaign.audience?.groupIds?.length) {
      await campaign.populate('audience.groupIds', 'name');
    }

    await AuditLog.log({ userId: req.userId, action: 'EDIT_CAMPAIGN', resource: 'Campaign', resourceId: req.params.id, ip: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true, data: { campaign }, message: 'Campaign updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update campaign', code: 'UPDATE_ERROR' });
  }
});

// DELETE /campaigns/:id — delete campaign
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found', code: 'NOT_FOUND' });
    
    // If it was running in the queue, we pause/cancel it
    if (campaign.status === 'running' || campaign.status === 'paused') {
      try {
        await queueService.pauseCampaign(campaign._id);
      } catch (e) {
        // ignore if queue service fails
      }
    }

    await AuditLog.log({ userId: req.userId, action: 'DELETE_CAMPAIGN', resource: 'Campaign', resourceId: req.params.id, ip: req.ip, userAgent: req.headers['user-agent'] });
    
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete campaign', code: 'DELETE_ERROR' });
  }
});

module.exports = router;
