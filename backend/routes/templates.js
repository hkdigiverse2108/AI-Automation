const router = require('express').Router();
const Template = require('../models/Template');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const whatsappService = require('../services/whatsapp');
const { decryptField } = require('../services/encryption');

async function preprocessComponents(components, headerMediaId, token) {
  if (!components || !Array.isArray(components)) return components;

  // Deep clone to avoid mutating original request payload
  const processed = JSON.parse(JSON.stringify(components));

  for (const comp of processed) {
    if (comp.type === 'BODY') {
      if (!comp.text) throw new Error('Body component must have text.');
      const matches = comp.text.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        // Ensure variable placeholders are sequential starting from 1
        const indices = matches.map(m => parseInt(m.replace(/[^0-9]/g, ''))).sort((a, b) => a - b);
        for (let i = 0; i < indices.length; i++) {
          if (indices[i] !== i + 1) {
            throw new Error(`Body variables must be sequential starting from 1. Found {{${indices[i]}}}, expected {{${i + 1}}}.`);
          }
        }
        
        // Inject example body text values
        comp.example = {
          body_text: [
            Array.from({ length: matches.length }, (_, i) => `value_${i + 1}`)
          ]
        };
      }
    }

    if (comp.type === 'HEADER') {
      if (comp.format === 'TEXT') {
        if (!comp.text) throw new Error('Header text component must have text.');
        const matches = comp.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          comp.example = {
            header_text: Array.from({ length: matches.length }, (_, i) => `header_val_${i + 1}`)
          };
        }
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
        if (!headerMediaId) {
          throw new Error(`Media upload is required for ${comp.format} header templates.`);
        }
        
        // Request the resumable upload handle from whatsappService
        const handle = await whatsappService.getResumableUploadHandleFromMediaId(headerMediaId, token);
        comp.example = {
          header_handle: [handle]
        };
      }
    }

    if (comp.type === 'FOOTER') {
      if (comp.text && comp.text.length > 60) {
        throw new Error('Footer text must not exceed 60 characters.');
      }
    }

    if (comp.type === 'BUTTONS') {
      if (comp.buttons && Array.isArray(comp.buttons)) {
        for (const btn of comp.buttons) {
          if (btn.text && btn.text.length > 25) {
            throw new Error(`Button text "${btn.text}" exceeds the 25-character limit.`);
          }
          if (btn.type === 'URL') {
            if (!btn.url) throw new Error('URL button must have a url.');
            const matches = btn.url.match(/\{\{(\d+)\}\}/g);
            if (matches) {
              btn.example = [`${btn.url.replace(/\{\{(\d+)\}\}/g, 'sample_param')}`];
            }
          }
          if (btn.type === 'PHONE_NUMBER') {
            if (!btn.phone_number) throw new Error('Phone number button must have a phone number.');
            if (!/^\+[1-9]\d{1,14}$/.test(btn.phone_number)) {
              throw new Error('Phone number button must be in E.164 format (e.g. +16505551234).');
            }
          }
        }
      }
    }
  }

  return processed;
}

router.use(verifyToken);

// GET /templates — list all
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find({ userId: req.userId }).sort('-updatedAt').lean();
    res.json({ success: true, data: { templates } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch templates', code: 'FETCH_ERROR' });
  }
});

// POST /templates/sync — sync templates from Meta
router.post('/sync', async (req, res) => {
  try {
    const waAccount = await WhatsAppAccount.findOne({ userId: req.userId, isActive: true });
    if (!waAccount) return res.status(400).json({ success: false, error: 'No active WA account', code: 'NO_WA_ACCOUNT' });

    const token = decryptField(waAccount.accessToken);
    const result = await whatsappService.getTemplates(waAccount.wabaId, token);
    if (!result.success) return res.status(400).json({ success: false, error: 'Failed to fetch from Meta', code: 'META_ERROR' });

    const metaTemplates = result.data?.data || [];
    let synced = 0;

    for (const mt of metaTemplates) {
      await Template.findOneAndUpdate(
        { userId: req.userId, metaTemplateId: mt.id },
        {
          userId: req.userId,
          name: mt.name,
          metaTemplateId: mt.id,
          category: mt.category,
          language: mt.language,
          status: mt.status,
          components: mt.components || [],
          variableCount: (mt.components || []).reduce((acc, c) => {
            const matches = (c.text || '').match(/\{\{[0-9]+\}\}/g);
            return acc + (matches ? matches.length : 0);
          }, 0),
        },
        { upsert: true, new: true }
      );
      synced++;
    }

    const metaIds = metaTemplates.map(mt => mt.id);
    const deleteResult = await Template.deleteMany({
      userId: req.userId,
      isCustom: { $ne: true },
      metaTemplateId: { $exists: true, $nin: metaIds }
    });

    res.json({
      success: true,
      data: { synced, deletedCount: deleteResult.deletedCount },
      message: `${synced} templates synced, ${deleteResult.deletedCount} stale templates removed`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sync failed', code: 'SYNC_ERROR' });
  }
});

// POST /templates — create new template on Meta or custom local
router.post('/', async (req, res) => {
  try {
    console.log('[TEMPLATES ROUTE] Incoming POST /templates payload:', JSON.stringify(req.body, null, 2));

    let { name, category, language, components, headerMediaId, isCustom, isCarousel, carouselCards } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required', code: 'MISSING_FIELDS' });

    // Normalize name to lowercase alphanumeric + underscores
    name = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    if (isCustom) {
      // Local custom / carousel template
      const template = await Template.create({
        userId: req.userId,
        name,
        category: category || 'MARKETING',
        language: language || 'en',
        status: 'APPROVED',
        components: components || [],
        headerMediaId,
        isCustom: true,
        isCarousel: !!isCarousel,
        carouselCards: carouselCards || null,
      });
      return res.status(201).json({ success: true, data: { template }, message: 'Custom local template created successfully' });
    }

    if (!components) return res.status(400).json({ success: false, error: 'Components required', code: 'MISSING_FIELDS' });

    const waAccount = await WhatsAppAccount.findOne({ userId: req.userId, isActive: true });
    if (!waAccount) return res.status(400).json({ success: false, error: 'No active WA account', code: 'NO_WA_ACCOUNT' });

    const token = decryptField(waAccount.accessToken);

    // Preprocess components to inject examples and media handles
    let processedComponents;
    try {
      processedComponents = await preprocessComponents(components, headerMediaId, token);
    } catch (preprocessErr) {
      console.error('[TEMPLATES ROUTE] Preprocessing components failed:', preprocessErr.message);
      return res.status(400).json({ success: false, error: preprocessErr.message, code: 'PREPROCESS_ERROR' });
    }

    console.log('[TEMPLATES ROUTE] Submitting to Meta Graph API with components:', JSON.stringify(processedComponents, null, 2));

    const result = await whatsappService.createTemplate(
      waAccount.wabaId,
      token,
      {
        name,
        category: category || 'MARKETING',
        language: language || 'en',
        components: processedComponents
      }
    );

    if (!result.success) {
      console.error('[TEMPLATES ROUTE] Meta template creation failed:', JSON.stringify(result, null, 2));
      return res.status(400).json({
        success: false,
        error: result.error || 'Meta API error',
        code: 'META_ERROR',
        details: {
          code: result.code,
          error_subcode: result.error_subcode,
          fbtrace_id: result.fbtrace_id,
          error_data: result.error_data,
          status: result.status
        }
      });
    }

    console.log('[TEMPLATES ROUTE] Meta template creation success:', JSON.stringify(result.data, null, 2));

    const template = await Template.create({
      userId: req.userId,
      name,
      metaTemplateId: result.data?.id,
      category: category || 'MARKETING',
      language: language || 'en',
      status: 'PENDING',
      components: processedComponents,
      headerMediaId,
    });

    res.status(201).json({ success: true, data: { template }, message: 'Template created and submitted for review' });
  } catch (error) {
    console.error('[TEMPLATES ROUTE] Failed to create template:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create template', code: 'CREATE_ERROR' });
  }
});

// GET /templates/:id
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!template) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: { template } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Fetch failed', code: 'FETCH_ERROR' });
  }
});

// PUT /templates/:id — edit template details
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    console.log('[TEMPLATES ROUTE] Incoming PUT /templates/:id payload:', JSON.stringify(req.body, null, 2));
    const { name, category, language, components, headerMediaId, isCustom, isCarousel, carouselCards, status } = req.body;
    const userId = req.userId;

    const template = await Template.findOne({ _id: req.params.id, userId });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

    if (name) {
      template.name = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    if (category) template.category = category;
    if (language) template.language = language;

    if (components) {
      const targetIsCustom = isCustom !== undefined ? isCustom : template.isCustom;
      if (!targetIsCustom) {
        const waAccount = await WhatsAppAccount.findOne({ userId, isActive: true });
        if (!waAccount) return res.status(400).json({ success: false, error: 'No active WA account found to preprocess template components', code: 'NO_WA_ACCOUNT' });
        const token = decryptField(waAccount.accessToken);
        const targetMediaId = headerMediaId !== undefined ? headerMediaId : template.headerMediaId;
        template.components = await preprocessComponents(components, targetMediaId, token);
      } else {
        template.components = components;
      }
    }

    if (headerMediaId !== undefined) template.headerMediaId = headerMediaId;
    if (isCustom !== undefined) template.isCustom = isCustom;
    if (isCarousel !== undefined) template.isCarousel = isCarousel;
    if (carouselCards !== undefined) template.carouselCards = carouselCards;
    if (status) template.status = status;

    await template.save();
    res.json({ success: true, data: { template }, message: 'Template updated successfully' });
  } catch (error) {
    console.error('[TEMPLATES ROUTE] Failed to update template:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update template' });
  }
});

// DELETE /templates/:id
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const template = await Template.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!template) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Delete failed', code: 'DELETE_ERROR' });
  }
});

module.exports = router;
