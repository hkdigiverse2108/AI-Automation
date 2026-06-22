const router = require('express').Router();
const ContactNote = require('../models/ContactNote');
const Contact = require('../models/Contact');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const { createNotification } = require('../services/notificationService');

router.use(verifyToken);

// Helper to determine if user has Admin or Manager privileges
function getUserPrivilege(user) {
  const privilege = user.role;
  const isManager = 
    (user.designation && /manager/i.test(user.designation)) || 
    (user.department && /manager/i.test(user.department));
  const isAdminOrManager = ['superadmin', 'owner', 'admin'].includes(privilege) || isManager;
  return { isAdminOrManager, isManager };
}

// PUT /api/notes/:id — update note details (RBAC: Admin, Manager, or Creator Agent)
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { note, isPinned } = req.body;

    const noteRecord = await ContactNote.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (!noteRecord) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // RBAC: Admins & Managers can edit any note. Agents can only edit their own note.
    const { isAdminOrManager } = getUserPrivilege(req.user);
    if (!isAdminOrManager && noteRecord.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Unauthorized. You can only edit notes you created.' });
    }

    let modified = false;

    if (note !== undefined) {
      if (!note.trim()) {
        return res.status(400).json({ success: false, error: 'Note content cannot be empty' });
      }
      noteRecord.note = note.trim();
      modified = true;
    }

    if (isPinned !== undefined) {
      noteRecord.isPinned = isPinned;
      modified = true;
    }

    if (modified) {
      await noteRecord.save();
      await noteRecord.populate('createdBy', 'name email role');

      const contact = await Contact.findOne({ _id: noteRecord.contactId, userId: req.userId });

      await createNotification({
        userId: req.user._id,
        organizationId: req.organizationId,
        type: 'contact',
        title: 'Note Edited 📝',
        message: `A note on contact "${contact ? (contact.name || contact.phone) : 'Unknown'}" was updated by ${req.user.name}.`,
        link: '/dashboard/contacts',
        metadata: { contactId: noteRecord.contactId, noteId: noteRecord._id }
      });
    }

    res.json({ success: true, data: { note: noteRecord }, message: 'Note updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update note', details: error.message });
  }
});

// POST /api/notes/:id/pin — pin/unpin note (RBAC: Admin, Manager, or Creator Agent)
router.post('/:id/pin', ...validateObjectId('id'), async (req, res) => {
  try {
    const noteRecord = await ContactNote.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (!noteRecord) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // RBAC: Admins & Managers can pin any note. Agents can only pin their own note.
    const { isAdminOrManager } = getUserPrivilege(req.user);
    if (!isAdminOrManager && noteRecord.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Unauthorized. You can only pin notes you created.' });
    }

    noteRecord.isPinned = !noteRecord.isPinned;
    await noteRecord.save();
    await noteRecord.populate('createdBy', 'name email role');

    const contact = await Contact.findOne({ _id: noteRecord.contactId, userId: req.userId });

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact',
      title: noteRecord.isPinned ? 'Note Pinned 📌' : 'Note Unpinned 📍',
      message: `A note on contact "${contact ? (contact.name || contact.phone) : 'Unknown'}" was ${noteRecord.isPinned ? 'pinned' : 'unpinned'} by ${req.user.name}.`,
      link: '/dashboard/contacts',
      metadata: { contactId: noteRecord.contactId, noteId: noteRecord._id }
    });

    res.json({
      success: true,
      data: { note: noteRecord },
      message: noteRecord.isPinned ? 'Note pinned successfully' : 'Note unpinned successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to pin note', details: error.message });
  }
});

// DELETE /api/notes/:id — delete note (RBAC: Admin or Manager only)
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const noteRecord = await ContactNote.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (!noteRecord) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // RBAC: Admins & Managers only can delete notes.
    const { isAdminOrManager } = getUserPrivilege(req.user);
    if (!isAdminOrManager) {
      return res.status(403).json({ success: false, error: 'Unauthorized. Only admins and managers can delete notes.' });
    }

    await ContactNote.deleteOne({ _id: noteRecord._id });

    const contact = await Contact.findOne({ _id: noteRecord.contactId, userId: req.userId });

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact',
      title: 'Note Deleted 🗑️',
      message: `A note on contact "${contact ? (contact.name || contact.phone) : 'Unknown'}" was deleted by ${req.user.name}.`,
      link: '/dashboard/contacts',
      metadata: { contactId: noteRecord.contactId }
    });

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete note', details: error.message });
  }
});

module.exports = router;
