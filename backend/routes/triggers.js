const router = require('express').Router();
const ReplyTrigger = require('../models/ReplyTrigger');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');

router.use(verifyToken);

// GET /api/triggers — list reply triggers
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { search, page = 1, limit = 50 } = req.query;
    
    const query = { userId };
    if (search) {
      query.triggerText = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await ReplyTrigger.countDocuments(query);

    const triggers = await ReplyTrigger.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit))
      .populate('templateIds', 'name category status')
      .lean();

    res.json({
      success: true,
      data: {
        triggers,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch reply triggers' });
  }
});

// POST /api/triggers — create a reply trigger
router.post('/', async (req, res) => {
  try {
    const { triggerText, templateIds, replyText, isFallback } = req.body;
    
    if (!isFallback && !triggerText) {
      return res.status(400).json({ success: false, error: 'Trigger keyword is required for non-fallback triggers' });
    }

    const userId = req.userId;

    if (isFallback) {
      // Deactivate any existing fallback responders for this user
      await ReplyTrigger.updateMany({ userId, isFallback: true }, { isActive: false });
    } else {
      // Check if keyword already exists
      const existing = await ReplyTrigger.findOne({ userId, triggerText: triggerText.trim().toLowerCase() });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Keyword trigger already exists' });
      }
    }

    const trigger = await ReplyTrigger.create({
      userId,
      triggerText: triggerText ? triggerText.trim().toLowerCase() : '',
      templateIds: templateIds || [],
      replyText: replyText || '',
      isFallback: !!isFallback,
    });

    const populated = await ReplyTrigger.findById(trigger._id).populate('templateIds', 'name category status').lean();

    res.status(201).json({ success: true, data: { trigger: populated }, message: 'Trigger responder created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create trigger', details: error.message });
  }
});

// PUT /api/triggers/:id — edit trigger
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { triggerText, templateIds, replyText, isFallback, isActive } = req.body;
    const userId = req.userId;

    const trigger = await ReplyTrigger.findOne({ _id: req.params.id, userId });
    if (!trigger) return res.status(404).json({ success: false, error: 'Trigger responder not found' });

    if (isFallback !== undefined) trigger.isFallback = isFallback;
    if (isActive !== undefined) trigger.isActive = isActive;
    if (replyText !== undefined) trigger.replyText = replyText;
    if (templateIds) trigger.templateIds = templateIds;

    if (triggerText !== undefined) {
      trigger.triggerText = triggerText ? triggerText.trim().toLowerCase() : '';
    }

    if (trigger.isFallback && trigger.isActive) {
      // Ensure only one active fallback
      await ReplyTrigger.updateMany({ userId, _id: { $ne: trigger._id }, isFallback: true }, { isActive: false });
    }

    await trigger.save();
    const populated = await ReplyTrigger.findById(trigger._id).populate('templateIds', 'name category status').lean();

    res.json({ success: true, data: { trigger: populated }, message: 'Trigger responder updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update trigger' });
  }
});

// DELETE /api/triggers/:id — delete trigger
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.userId;
    const trigger = await ReplyTrigger.findOneAndDelete({ _id: req.params.id, userId });
    if (!trigger) return res.status(404).json({ success: false, error: 'Trigger responder not found' });
    res.json({ success: true, message: 'Trigger responder deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete trigger' });
  }
});

module.exports = router;
