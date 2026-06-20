const router = require('express').Router();
const ContactNote = require('../models/ContactNote');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');

router.use(verifyToken);

// PUT /api/notes/:id — update note or toggle pin
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

    if (note !== undefined) {
      if (!note.trim()) {
        return res.status(400).json({ success: false, error: 'Note content cannot be empty' });
      }
      noteRecord.note = note.trim();
    }

    if (isPinned !== undefined) {
      noteRecord.isPinned = isPinned;
    }

    await noteRecord.save();
    await noteRecord.populate('createdBy', 'name email role');

    res.json({ success: true, data: { note: noteRecord }, message: 'Note updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update note', details: error.message });
  }
});

// DELETE /api/notes/:id — delete note
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const noteRecord = await ContactNote.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (!noteRecord) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete note', details: error.message });
  }
});

module.exports = router;
