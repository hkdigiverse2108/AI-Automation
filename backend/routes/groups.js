const router = require('express').Router();
const mongoose = require('mongoose');
const Group = require('../models/Group');
const ContactGroup = require('../models/ContactGroup');
const Contact = require('../models/Contact');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const { createNotification } = require('../services/notificationService');

router.use(verifyToken);
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
router.use(checkFeatureAccess('groups'));

// GET /groups — List groups in organization with contact counts, search, and pagination
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { organizationId: req.organizationId };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const skip = (pageInt - 1) * limitInt;

    const [groups, total] = await Promise.all([
      Group.find(query).sort('-createdAt').skip(skip).limit(limitInt).lean(),
      Group.countDocuments(query),
    ]);

    // Fetch contact counts per group in a single aggregation pipeline
    const counts = await ContactGroup.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(req.organizationId) } },
      { $group: { _id: '$groupId', count: { $sum: 1 } } },
    ]);

    const countMap = counts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const data = groups.map((g) => ({
      ...g,
      contactCount: countMap[g._id.toString()] || 0,
    }));

    res.json({
      success: true,
      data: {
        groups: data,
        total,
        page: pageInt,
        pages: Math.ceil(total / limitInt),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch groups', code: 'FETCH_ERROR' });
  }
});

// GET /groups/:id — Get details of a single group
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, organizationId: req.organizationId }).lean();
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    }

    const contactCount = await ContactGroup.countDocuments({ groupId: group._id, organizationId: req.organizationId });

    res.json({
      success: true,
      data: {
        group: {
          ...group,
          contactCount,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch group', code: 'FETCH_ERROR' });
  }
});

// POST /groups — Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Group name is required', code: 'VALIDATION_ERROR' });
    }

    // Check unique name under organization
    const existing = await Group.findOne({ organizationId: req.organizationId, name: name.trim() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Group name already exists', code: 'DUPLICATE' });
    }

    const group = await Group.create({
      organizationId: req.organizationId,
      name: name.trim(),
      description: description || '',
      createdBy: req.user._id,
    });

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact', // Categorized as contact/group type
      title: 'Contact Group Created 👥',
      message: `Group "${group.name}" was successfully created.`,
      link: '/dashboard/contacts/groups',
      metadata: { groupId: group._id }
    });

    res.status(201).json({ success: true, data: { group }, message: 'Group created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create group', code: 'CREATE_ERROR' });
  }
});

// PUT /groups/:id — Update an existing group
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = await Group.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, error: 'Group name cannot be empty', code: 'VALIDATION_ERROR' });
      }

      // Ensure unique name if updated
      if (trimmedName !== group.name) {
        const existing = await Group.findOne({ organizationId: req.organizationId, name: trimmedName });
        if (existing) {
          return res.status(409).json({ success: false, error: 'Group name already exists', code: 'DUPLICATE' });
        }
        group.name = trimmedName;
      }
    }

    if (description !== undefined) {
      group.description = description;
    }

    await group.save();

    res.json({ success: true, data: { group }, message: 'Group updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update group', code: 'UPDATE_ERROR' });
  }
});

// DELETE /groups/:id — Delete a group and its contact mappings
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    }

    // Cascade delete contact_groups associations
    await ContactGroup.deleteMany({ groupId: group._id, organizationId: req.organizationId });

    // Delete the group
    await Group.deleteOne({ _id: group._id });

    res.json({ success: true, message: 'Group and all associated mappings deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete group', code: 'DELETE_ERROR' });
  }
});

// POST /groups/:id/add-contact — Add multiple contacts to group
router.post('/:id/add-contact', ...validateObjectId('id'), async (req, res) => {
  try {
    const { contactIds } = req.body;
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ success: false, error: 'contactIds array is required', code: 'VALIDATION_ERROR' });
    }

    const group = await Group.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    }

    // Verify all contacts belong to organization
    const verifiedContacts = await Contact.find({
      _id: { $in: contactIds },
      userId: req.userId,
      isDeleted: { $ne: true },
    }).select('_id');

    if (verifiedContacts.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid contacts found', code: 'VALIDATION_ERROR' });
    }

    // Bulk write to prevent duplicates
    const ops = verifiedContacts.map((c) => ({
      updateOne: {
        filter: { contactId: c._id, groupId: group._id, organizationId: req.organizationId },
        update: { $setOnInsert: { contactId: c._id, groupId: group._id, organizationId: req.organizationId } },
        upsert: true,
      },
    }));

    const result = await ContactGroup.bulkWrite(ops);

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact',
      title: 'Contacts Added to Group 👥',
      message: `${result.upsertedCount || 0} contact(s) added to group "${group.name}".`,
      link: '/dashboard/contacts/groups',
      metadata: { groupId: group._id, addedCount: result.upsertedCount }
    });

    res.json({
      success: true,
      data: {
        addedCount: result.upsertedCount || 0,
        totalRequested: contactIds.length,
      },
      message: 'Contacts added to group successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add contacts to group', code: 'ADD_ERROR' });
  }
});

// POST /groups/:id/remove-contact — Remove multiple contacts from group
router.post('/:id/remove-contact', ...validateObjectId('id'), async (req, res) => {
  try {
    const { contactIds } = req.body;
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ success: false, error: 'contactIds array is required', code: 'VALIDATION_ERROR' });
    }

    const group = await Group.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    }

    const deleteResult = await ContactGroup.deleteMany({
      groupId: group._id,
      contactId: { $in: contactIds },
      organizationId: req.organizationId,
    });

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact',
      title: 'Contacts Removed from Group 👥',
      message: `${deleteResult.deletedCount || 0} contact(s) removed from group "${group.name}".`,
      link: '/dashboard/contacts/groups',
      metadata: { groupId: group._id, removedCount: deleteResult.deletedCount }
    });

    res.json({
      success: true,
      data: {
        removedCount: deleteResult.deletedCount || 0,
      },
      message: 'Contacts removed from group successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove contacts from group', code: 'REMOVE_ERROR' });
  }
});

module.exports = router;
