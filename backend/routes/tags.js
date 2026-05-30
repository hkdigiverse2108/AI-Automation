const router = require('express').Router();
const Tag = require('../models/Tag');
const AutoTagRule = require('../models/AutoTagRule');
const Contact = require('../models/Contact');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');

router.use(verifyToken);

// GET /api/tags — list tags and auto tag rules
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const tags = await Tag.find({ userId }).sort('name').lean();
    const rules = await AutoTagRule.find({ userId }).sort('-createdAt').lean();
    res.json({ success: true, data: { tags, rules } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tags data' });
  }
});

// POST /api/tags — create a tag entry
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Tag name is required' });

    const userId = req.userId;
    const normalizedName = name.trim().toLowerCase();

    // Check if tag already exists
    const existing = await Tag.findOne({ userId, name: normalizedName });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Tag already exists' });
    }

    const tag = await Tag.create({
      userId,
      name: normalizedName,
      color: color || '#3b82f6',
    });

    res.status(201).json({ success: true, data: { tag }, message: 'Tag created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create tag', details: error.message });
  }
});

// DELETE /api/tags/:name — delete a tag and pull it from all contacts
router.delete('/:name', async (req, res) => {
  try {
    const userId = req.userId;
    const tagName = req.params.name.trim().toLowerCase();

    const tag = await Tag.findOneAndDelete({ userId, name: tagName });
    if (!tag) return res.status(404).json({ success: false, error: 'Tag not found' });

    // Pull from all contact tags
    await Contact.updateMany({ userId, tags: tagName }, { $pull: { tags: tagName } });

    res.json({ success: true, message: 'Tag deleted and removed from contacts' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete tag' });
  }
});

// POST /api/tags/rules — add auto-tag assignment rule
router.post('/rules', async (req, res) => {
  try {
    const { ruleName, triggerType, triggerValue, tagToAssign } = req.body;
    if (!ruleName || !triggerType || !triggerValue || !tagToAssign) {
      return res.status(400).json({ success: false, error: 'Missing required rule parameters' });
    }

    const userId = req.userId;
    const rule = await AutoTagRule.create({
      userId,
      ruleName,
      triggerType,
      triggerValue: triggerValue.trim().toLowerCase(),
      tagToAssign: tagToAssign.trim().toLowerCase(),
    });

    res.status(201).json({ success: true, data: { rule }, message: 'Auto-tag rule created' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create auto-tag rule' });
  }
});

// PUT /api/tags/rules/:id — update auto-tag rule
router.put('/rules/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { ruleName, triggerType, triggerValue, tagToAssign, isActive } = req.body;
    const userId = req.userId;

    const rule = await AutoTagRule.findOne({ _id: req.params.id, userId });
    if (!rule) return res.status(404).json({ success: false, error: 'Auto-tag rule not found' });

    if (ruleName) rule.ruleName = ruleName;
    if (triggerType) rule.triggerType = triggerType;
    if (triggerValue !== undefined) rule.triggerValue = triggerValue.trim().toLowerCase();
    if (tagToAssign !== undefined) rule.tagToAssign = tagToAssign.trim().toLowerCase();
    if (isActive !== undefined) rule.isActive = isActive;

    await rule.save();
    res.json({ success: true, data: { rule }, message: 'Auto-tag rule updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update auto-tag rule' });
  }
});

// DELETE /api/tags/rules/:id — delete auto-tag rule
router.delete('/rules/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.userId;
    const rule = await AutoTagRule.findOneAndDelete({ _id: req.params.id, userId });
    if (!rule) return res.status(404).json({ success: false, error: 'Auto-tag rule not found' });
    res.json({ success: true, message: 'Auto-tag rule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete auto-tag rule' });
  }
});

module.exports = router;
