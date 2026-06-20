const router = require('express').Router();
const mongoose = require('mongoose');
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
    const query = req.organizationId ? { organizationId: req.organizationId } : { userId };
    
    const tags = await Tag.find(query).sort('name').lean();
    const rules = await AutoTagRule.find({ userId }).sort('-createdAt').lean();
    res.json({ success: true, data: { tags, rules } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tags data' });
  }
});

// GET /api/tags/:id — fetch single tag details
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const query = req.organizationId
      ? { _id: req.params.id, organizationId: req.organizationId }
      : { _id: req.params.id, userId: req.userId };
    
    const tag = await Tag.findOne(query).lean();
    if (!tag) return res.status(404).json({ success: false, error: 'Tag not found' });
    
    res.json({ success: true, data: { tag } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tag details' });
  }
});

// POST /api/tags — create a tag entry
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Tag name is required' });

    const userId = req.userId;
    const normalizedName = name.trim().toLowerCase();

    // Check if tag already exists in organization context
    const query = req.organizationId
      ? { organizationId: req.organizationId, name: normalizedName }
      : { userId, name: normalizedName };

    const existing = await Tag.findOne(query);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Tag already exists' });
    }

    const tag = await Tag.create({
      userId,
      organizationId: req.organizationId,
      name: normalizedName,
      color: color || '#3b82f6',
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: { tag }, message: 'Tag created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create tag', details: error.message });
  }
});

// PUT /api/tags/:id — update a tag entry
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { name, color } = req.body;
    const query = req.organizationId
      ? { _id: req.params.id, organizationId: req.organizationId }
      : { _id: req.params.id, userId: req.userId };

    const tag = await Tag.findOne(query);
    if (!tag) return res.status(404).json({ success: false, error: 'Tag not found' });

    if (name !== undefined) {
      const normalizedName = name.trim().toLowerCase();
      if (!normalizedName) return res.status(400).json({ success: false, error: 'Tag name cannot be empty' });

      if (normalizedName !== tag.name) {
        // Prevent duplicate name
        const dupQuery = req.organizationId
          ? { organizationId: req.organizationId, name: normalizedName }
          : { userId: req.userId, name: normalizedName };

        const dup = await Tag.findOne(dupQuery);
        if (dup) return res.status(400).json({ success: false, error: 'Tag name already exists' });

        // Update tag name in all contacts
        const oldName = tag.name;
        await Contact.updateMany(
          { userId: req.userId, tags: oldName },
          { $set: { "tags.$[elem]": normalizedName } },
          { arrayFilters: [{ "elem": oldName }] }
        );
        tag.name = normalizedName;
      }
    }

    if (color !== undefined) {
      tag.color = color;
    }

    await tag.save();
    res.json({ success: true, data: { tag }, message: 'Tag updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update tag', details: error.message });
  }
});

// DELETE /api/tags/:idOrName — delete a tag and pull it from all contacts
router.delete('/:idOrName', async (req, res) => {
  try {
    const userId = req.userId;
    const param = req.params.idOrName.trim();
    let tag;

    const baseQuery = req.organizationId ? { organizationId: req.organizationId } : { userId };

    if (mongoose.Types.ObjectId.isValid(param)) {
      tag = await Tag.findOneAndDelete({ ...baseQuery, _id: param });
    }

    if (!tag) {
      tag = await Tag.findOneAndDelete({ ...baseQuery, name: param.toLowerCase() });
    }

    if (!tag) return res.status(404).json({ success: false, error: 'Tag not found' });

    // Delete mappings from ContactTag and pull from contact.tags array
    const ContactTag = require('../models/ContactTag');
    await ContactTag.deleteMany({ tagId: tag._id });
    await Contact.updateMany({ userId, tags: tag.name }, { $pull: { tags: tag.name } });

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
