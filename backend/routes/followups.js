const router = require('express').Router();
const mongoose = require('mongoose');
const FollowUp = require('../models/FollowUp');
const Contact = require('../models/Contact');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');

router.use(verifyToken);

// GET /follow-ups — List follow-ups with search, filters, and populate details
router.get('/', async (req, res) => {
  try {
    const { status, contactId, assignedTo, dateStart, dateEnd, search, page = 1, limit = 20, sort = 'scheduledAt' } = req.query;
    const query = { organizationId: req.organizationId };

    if (status) query.status = status;
    if (contactId && mongoose.Types.ObjectId.isValid(contactId)) query.contactId = contactId;
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) query.assignedTo = assignedTo;

    // Filter by scheduled Date range
    if (dateStart || dateEnd) {
      query.scheduledAt = {};
      if (dateStart) query.scheduledAt.$gte = new Date(dateStart);
      if (dateEnd) query.scheduledAt.$lte = new Date(dateEnd);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const skip = (pageInt - 1) * limitInt;

    const [followUps, total] = await Promise.all([
      FollowUp.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitInt)
        .populate({
          path: 'contactId',
          select: '_id name phone email profilePic isEncrypted userId'
        })
        .populate({
          path: 'assignedTo',
          select: '_id name email role avatar'
        })
        .populate({
          path: 'createdBy',
          select: '_id name email'
        })
        .lean(),
      FollowUp.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        followUps,
        total,
        page: pageInt,
        pages: Math.ceil(total / limitInt),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch follow-ups', code: 'FETCH_ERROR' });
  }
});

// GET /follow-ups/:id — Get details of a single follow-up
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const followUp = await FollowUp.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate('contactId')
      .populate('assignedTo', '_id name email role avatar')
      .populate('createdBy', '_id name email')
      .lean();

    if (!followUp) {
      return res.status(404).json({ success: false, error: 'Follow-up not found', code: 'NOT_FOUND' });
    }

    res.json({ success: true, data: { followUp } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch follow-up', code: 'FETCH_ERROR' });
  }
});

// POST /follow-ups — Create a new follow-up
router.post('/', async (req, res) => {
  try {
    const { contactId, assignedTo, title, description, followUpType, scheduledAt } = req.body;

    if (!contactId || !assignedTo || !title || !followUpType || !scheduledAt) {
      return res.status(400).json({ success: false, error: 'Missing required fields', code: 'VALIDATION_ERROR' });
    }

    // Validate enum type
    const validTypes = ['whatsapp', 'call', 'email', 'manual'];
    if (!validTypes.includes(followUpType)) {
      return res.status(400).json({ success: false, error: 'Invalid follow-up type', code: 'VALIDATION_ERROR' });
    }

    // Verify contact belongs to organization / user
    const contact = await Contact.findOne({ _id: contactId, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found', code: 'NOT_FOUND' });
    }

    // Verify assigned user belongs to the same organization
    const agent = await User.findOne({ _id: assignedTo, organizationId: req.organizationId, isDeleted: { $ne: true } });
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Assigned agent not found', code: 'NOT_FOUND' });
    }

    const followUp = await FollowUp.create({
      organizationId: req.organizationId,
      contactId,
      assignedTo,
      title: title.trim(),
      description: description || '',
      followUpType,
      scheduledAt: new Date(scheduledAt),
      status: 'pending',
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: { followUp }, message: 'Follow-up scheduled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create follow-up', code: 'CREATE_ERROR' });
  }
});

// PUT /follow-ups/:id — Update an existing follow-up
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { title, description, followUpType, scheduledAt, assignedTo, status } = req.body;
    const followUp = await FollowUp.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!followUp) {
      return res.status(404).json({ success: false, error: 'Follow-up not found', code: 'NOT_FOUND' });
    }

    if (title !== undefined) followUp.title = title.trim();
    if (description !== undefined) followUp.description = description;
    if (followUpType !== undefined) {
      const validTypes = ['whatsapp', 'call', 'email', 'manual'];
      if (!validTypes.includes(followUpType)) {
        return res.status(400).json({ success: false, error: 'Invalid follow-up type', code: 'VALIDATION_ERROR' });
      }
      followUp.followUpType = followUpType;
    }
    if (scheduledAt !== undefined) followUp.scheduledAt = new Date(scheduledAt);
    
    if (assignedTo !== undefined) {
      const agent = await User.findOne({ _id: assignedTo, organizationId: req.organizationId, isDeleted: { $ne: true } });
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Assigned agent not found', code: 'NOT_FOUND' });
      }
      followUp.assignedTo = assignedTo;
    }

    if (status !== undefined) {
      const validStatuses = ['pending', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status value', code: 'VALIDATION_ERROR' });
      }
      followUp.status = status;
      if (status === 'completed') {
        followUp.completedAt = new Date();
      } else {
        followUp.completedAt = undefined;
      }
    }

    await followUp.save();

    res.json({ success: true, data: { followUp }, message: 'Follow-up updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update follow-up', code: 'UPDATE_ERROR' });
  }
});

// DELETE /follow-ups/:id — Permanently delete a follow-up
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const followUp = await FollowUp.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!followUp) {
      return res.status(404).json({ success: false, error: 'Follow-up not found', code: 'NOT_FOUND' });
    }

    await FollowUp.deleteOne({ _id: followUp._id });

    res.json({ success: true, message: 'Follow-up deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete follow-up', code: 'DELETE_ERROR' });
  }
});

// POST /follow-ups/:id/complete — Mark a follow-up completed manually
router.post('/:id/complete', ...validateObjectId('id'), async (req, res) => {
  try {
    const followUp = await FollowUp.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!followUp) {
      return res.status(404).json({ success: false, error: 'Follow-up not found', code: 'NOT_FOUND' });
    }

    followUp.status = 'completed';
    followUp.completedAt = new Date();
    await followUp.save();

    res.json({ success: true, data: { followUp }, message: 'Follow-up marked as completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to complete follow-up', code: 'COMPLETE_ERROR' });
  }
});

module.exports = router;
