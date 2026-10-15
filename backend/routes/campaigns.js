const router = require('express').Router();
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/auth');
const { campaignValidation, validateObjectId } = require('../middleware/validator');
const queueService = require('../services/queueService');
const multer = require('multer');
const upload = multer({ limits: { fileSize: 30 * 1024 * 1024 } }); // 30MB limit for image, video, and documents

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

    // Validate that required template variables are not empty
    const Template = require('../models/Template');
    const tmplQuery = { userId: req.userId };
    if (templateId && mongoose.Types.ObjectId.isValid(templateId)) {
      tmplQuery._id = templateId;
    } else {
      tmplQuery.name = templateName;
    }
    const tmpl = await Template.findOne(tmplQuery);
    if (tmpl) {
      const bodyComp = tmpl.components?.find(c => c.type === 'BODY' || c.type?.toLowerCase() === 'body');
      const varMatches = (bodyComp?.text || '').match(/\{\{[0-9]+\}\}/g) || [];
      const requiredVarCount = varMatches.length;

      if (requiredVarCount > 0) {
        if (!Array.isArray(variables) || variables.length < requiredVarCount) {
          return res.status(400).json({
            success: false,
            error: `Template "${tmpl.name}" requires ${requiredVarCount} variable(s). Please fill in all variables.`,
            code: 'MISSING_VARIABLES'
          });
        }
        for (let i = 0; i < requiredVarCount; i++) {
          if (!variables[i] || !String(variables[i]).trim()) {
            return res.status(400).json({
              success: false,
              error: `Variable {{${i + 1}}} cannot be empty. Please provide a value or dynamic tag like {{name}}.`,
              code: 'EMPTY_VARIABLE'
            });
          }
        }
      }
    }

    let parsedScheduledAt = undefined;
    if (scheduledAt) {
      const schedTime = new Date(scheduledAt).getTime();
      if (isNaN(schedTime)) {
        return res.status(400).json({ success: false, error: 'Invalid scheduled date format', code: 'INVALID_SCHEDULE' });
      }
      if (schedTime <= Date.now() + 60000) {
        return res.status(400).json({ success: false, error: 'Scheduled time must be at least 1-2 minutes in the future', code: 'PAST_SCHEDULE_TIME' });
      }
      parsedScheduledAt = new Date(schedTime);
    }

    const campaign = await Campaign.create({
      userId: req.userId,
      name,
      templateName,
      templateId,
      audience: audience || { type: 'all' },
      variables: variables || [],
      headerMediaId,
      isUnofficial: !!isUnofficial,
      status: parsedScheduledAt ? 'scheduled' : 'draft',
      scheduledAt: parsedScheduledAt,
    });
    
    if (campaign.audience?.groupIds?.length) {
      await campaign.populate('audience.groupIds', 'name');
    }

    res.status(201).json({ success: true, data: { campaign }, message: 'Campaign created' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create campaign', code: 'CREATE_ERROR' });
  }
});

// POST /campaigns/upload-image and /campaigns/upload-media — upload file (image/video/document) to Meta
const handleMediaUpload = async (req, res) => {
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
};

router.post('/upload-image', upload.single('file'), handleMediaUpload);
router.post('/upload-media', upload.single('file'), handleMediaUpload);

// POST /campaigns/:id/start
router.post('/:id/start', ...validateObjectId('id'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.userId });
    if (!campaign) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });

    if (!['draft', 'scheduled', 'failed'].includes(campaign.status)) {
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

    // Only allow editing drafts, scheduled or failed campaigns
    if (!['draft', 'scheduled', 'failed'].includes(campaign.status)) {
      return res.status(400).json({ success: false, error: 'Only drafts, scheduled, or failed campaigns can be edited', code: 'INVALID_STATUS' });
    }

    const { name, templateName, templateId, audience, variables, scheduledAt, headerMediaId } = req.body;

    const targetTemplateName = templateName || campaign.templateName;
    const targetTemplateId = templateId || campaign.templateId;

    if (variables !== undefined) {
      const Template = require('../models/Template');
      const tmplQuery = { userId: req.userId };
      if (targetTemplateId && mongoose.Types.ObjectId.isValid(targetTemplateId)) {
        tmplQuery._id = targetTemplateId;
      } else {
        tmplQuery.name = targetTemplateName;
      }
      const tmpl = await Template.findOne(tmplQuery);
      if (tmpl) {
        const bodyComp = tmpl.components?.find(c => c.type === 'BODY' || c.type?.toLowerCase() === 'body');
        const varMatches = (bodyComp?.text || '').match(/\{\{[0-9]+\}\}/g) || [];
        const requiredVarCount = varMatches.length;

        if (requiredVarCount > 0) {
          if (!Array.isArray(variables) || variables.length < requiredVarCount) {
            return res.status(400).json({
              success: false,
              error: `Template requires ${requiredVarCount} variable(s). Please fill in all variables.`,
              code: 'MISSING_VARIABLES'
            });
          }
          for (let i = 0; i < requiredVarCount; i++) {
            if (!variables[i] || !String(variables[i]).trim()) {
              return res.status(400).json({
                success: false,
                error: `Variable {{${i + 1}}} cannot be empty.`,
                code: 'EMPTY_VARIABLE'
              });
            }
          }
        }
      }
      campaign.variables = variables;
    }

    if (name) campaign.name = name;
    if (templateName) campaign.templateName = templateName;
    if (templateId) campaign.templateId = templateId;
    if (audience) campaign.audience = audience;
    if (headerMediaId !== undefined) campaign.headerMediaId = headerMediaId;
    
    if (scheduledAt !== undefined) {
      if (scheduledAt) {
        const schedTime = new Date(scheduledAt).getTime();
        if (isNaN(schedTime)) {
          return res.status(400).json({ success: false, error: 'Invalid scheduled date format', code: 'INVALID_SCHEDULE' });
        }
        if (schedTime <= Date.now() + 60000) {
          return res.status(400).json({ success: false, error: 'Scheduled time must be at least 1-2 minutes in the future', code: 'PAST_SCHEDULE_TIME' });
        }
        campaign.scheduledAt = new Date(schedTime);
        campaign.status = 'scheduled';
      } else {
        campaign.scheduledAt = undefined;
        campaign.status = 'draft';
      }
    } else if (campaign.status === 'failed') {
      campaign.status = 'draft';
      campaign.lastError = undefined;
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

// POST /campaigns/:id/unschedule — Cancel schedule and move back to draft
router.post('/:id/unschedule', ...validateObjectId('id'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.userId });
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found', code: 'NOT_FOUND' });

    if (campaign.status !== 'scheduled') {
      return res.status(400).json({ success: false, error: 'Only scheduled campaigns can be unscheduled', code: 'INVALID_STATUS' });
    }

    campaign.status = 'draft';
    campaign.scheduledAt = undefined;
    await campaign.save();

    await AuditLog.log({ userId: req.userId, action: 'UNSCHEDULE_CAMPAIGN', resource: 'Campaign', resourceId: req.params.id, ip: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true, message: 'Campaign schedule canceled. Moved to drafts.', data: { campaign } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to unschedule campaign', code: 'UNSCHEDULE_ERROR' });
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
