const router = require('express').Router();
const Template = require('../models/Template');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const whatsappService = require('../services/whatsapp');
const { decryptField } = require('../services/encryption');

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
    if (!result.success) return res.status(502).json({ success: false, error: 'Failed to fetch from Meta', code: 'META_ERROR' });

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

    res.json({ success: true, data: { synced }, message: `${synced} templates synced` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sync failed', code: 'SYNC_ERROR' });
  }
});

// POST /templates — create new template on Meta or custom local
router.post('/', async (req, res) => {
  try {
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
    const result = await whatsappService.createTemplate(waAccount.wabaId, token, { name, category: category || 'MARKETING', language: language || 'en', components });

    if (!result.success) return res.status(502).json({ success: false, error: result.error || 'Meta API error', code: 'META_ERROR' });

    const template = await Template.create({
      userId: req.userId,
      name,
      metaTemplateId: result.data?.id,
      category: category || 'MARKETING',
      language: language || 'en',
      status: 'PENDING',
      components,
      headerMediaId,
    });

    res.status(201).json({ success: true, data: { template }, message: 'Template created and submitted for review' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create template', code: 'CREATE_ERROR' });
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
    const { name, category, language, components, headerMediaId, isCustom, isCarousel, carouselCards, status } = req.body;
    const userId = req.userId;

    const template = await Template.findOne({ _id: req.params.id, userId });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

    if (name) {
      template.name = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    if (category) template.category = category;
    if (language) template.language = language;
    if (components) template.components = components;
    if (headerMediaId !== undefined) template.headerMediaId = headerMediaId;
    if (isCustom !== undefined) template.isCustom = isCustom;
    if (isCarousel !== undefined) template.isCarousel = isCarousel;
    if (carouselCards !== undefined) template.carouselCards = carouselCards;
    if (status) template.status = status;

    await template.save();
    res.json({ success: true, data: { template }, message: 'Template updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update template' });
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
