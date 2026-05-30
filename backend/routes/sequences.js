const router = require('express').Router();
const Sequence = require('../models/Sequence');
const SequenceExecution = require('../models/SequenceExecution');
const Contact = require('../models/Contact');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');

router.use(verifyToken);

// GET /api/sequences — get sequences and active execution logs
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const sequences = await Sequence.find({ userId }).sort('-createdAt').lean();
    const executions = await SequenceExecution.find({ userId })
      .sort('-updatedAt')
      .populate('sequenceId', 'name')
      .populate('contactId', 'name phone')
      .lean();
    res.json({ success: true, data: { sequences, executions } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch sequences' });
  }
});

// POST /api/sequences — create new sequence
router.post('/', async (req, res) => {
  try {
    const { name, triggerTag, messages } = req.body;
    if (!name || !messages || !messages.length) {
      return res.status(400).json({ success: false, error: 'Name and sequence messages are required' });
    }

    const userId = req.userId;
    const sequence = await Sequence.create({
      userId,
      name,
      triggerTag: triggerTag || '',
      messages,
    });

    res.status(201).json({ success: true, data: { sequence }, message: 'Sequence created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create sequence', details: error.message });
  }
});

// PUT /api/sequences/:id — edit sequence
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { name, triggerTag, messages, isActive } = req.body;
    const userId = req.userId;

    const sequence = await Sequence.findOne({ _id: req.params.id, userId });
    if (!sequence) return res.status(404).json({ success: false, error: 'Sequence not found' });

    if (name) sequence.name = name;
    if (triggerTag !== undefined) sequence.triggerTag = triggerTag;
    if (messages) sequence.messages = messages;
    if (isActive !== undefined) sequence.isActive = isActive;

    await sequence.save();
    res.json({ success: true, data: { sequence }, message: 'Sequence updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update sequence' });
  }
});

// DELETE /api/sequences/:id — delete sequence
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.userId;
    const sequence = await Sequence.findOneAndDelete({ _id: req.params.id, userId });
    if (!sequence) return res.status(404).json({ success: false, error: 'Sequence not found' });

    // Cancel all running executions of this sequence
    await SequenceExecution.updateMany({ userId, sequenceId: sequence._id, status: 'running' }, { status: 'cancelled' });

    res.json({ success: true, message: 'Sequence deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete sequence' });
  }
});

// POST /api/sequences/assign — assign sequence to contacts
router.post('/assign', async (req, res) => {
  try {
    const { sequenceId, contactIds } = req.body;
    if (!sequenceId || !contactIds || !contactIds.length) {
      return res.status(400).json({ success: false, error: 'Sequence ID and Contact IDs are required' });
    }

    const userId = req.userId;
    const sequence = await Sequence.findOne({ _id: sequenceId, userId, isActive: true });
    if (!sequence) return res.status(404).json({ success: false, error: 'Active sequence not found' });

    const firstMsg = sequence.messages[0];
    if (!firstMsg) return res.status(400).json({ success: false, error: 'Sequence has no messages configured' });

    // Calculate delay
    const now = new Date();
    let delayMs = 0;
    if (firstMsg.delayUnit === 'minutes') delayMs = firstMsg.delayValue * 60 * 1000;
    else if (firstMsg.delayUnit === 'hours') delayMs = firstMsg.delayValue * 60 * 60 * 1000;
    else delayMs = firstMsg.delayValue * 24 * 60 * 60 * 1000; // days

    const scheduledAt = new Date(now.getTime() + delayMs);

    let assigned = 0;
    for (const contactId of contactIds) {
      const contact = await Contact.findOne({ _id: contactId, userId, isDeleted: { $ne: true } });
      if (!contact) continue;

      // Cancel existing execution of the same sequence if it is running
      await SequenceExecution.updateMany({ userId, contactId, sequenceId, status: 'running' }, { status: 'cancelled' });

      // Create new execution
      await SequenceExecution.create({
        userId,
        sequenceId,
        contactId,
        nextStepIndex: 0,
        scheduledAt,
        status: 'running',
      });
      assigned++;
    }

    res.json({ success: true, message: `Sequence successfully assigned to ${assigned} contacts.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to assign sequence', details: error.message });
  }
});

module.exports = router;
