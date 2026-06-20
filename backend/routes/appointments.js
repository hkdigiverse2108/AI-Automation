const router = require('express').Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Contact = require('../models/Contact');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const { createNotification } = require('../services/notificationService');

router.use(verifyToken);

// GET /appointments — List appointments
router.get('/', async (req, res) => {
  try {
    const { status, contactId, assignedTo, page = 1, limit = 20 } = req.query;
    const query = { organizationId: req.organizationId };

    if (status) query.status = status;
    if (contactId && mongoose.Types.ObjectId.isValid(contactId)) query.contactId = contactId;
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) query.assignedTo = assignedTo;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .sort({ scheduledAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('contactId', 'name phone email')
        .populate('assignedTo', 'name email role avatar')
        .populate('createdBy', 'name email')
        .lean(),
      Appointment.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        appointments,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch appointments', details: error.message });
  }
});

// POST /appointments — Create appointment
router.post('/', async (req, res) => {
  try {
    const { title, description, contactId, assignedTo, scheduledAt, duration, reminderTime } = req.body;
    if (!title || !contactId || !assignedTo || !scheduledAt) {
      return res.status(400).json({ success: false, error: 'Title, contactId, assignedTo, and scheduledAt are required' });
    }

    // Verify contact belongs to organization
    const contact = await Contact.findOne({ _id: contactId, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    // Verify assignee belongs to organization
    const agent = await User.findOne({ _id: assignedTo, organizationId: req.organizationId, isDeleted: { $ne: true } });
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Assigned user not found' });
    }

    const appointment = await Appointment.create({
      organizationId: req.organizationId,
      title,
      description: description || '',
      contactId,
      assignedTo,
      scheduledAt: new Date(scheduledAt),
      duration: duration || 30,
      reminderTime: reminderTime || 15,
      status: 'pending',
      createdBy: req.user._id
    });

    // Notify assignee
    if (assignedTo.toString() !== req.user._id.toString()) {
      await createNotification({
        userId: assignedTo,
        organizationId: req.organizationId,
        type: 'appointment',
        title: 'New Appointment Scheduled 📅',
        message: `You have a new appointment: "${title}" with ${contact.name || contact.phone}.`,
        link: '/dashboard/contacts',
        metadata: { appointmentId: appointment._id }
      });
    }

    res.status(201).json({ success: true, data: { appointment }, message: 'Appointment created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create appointment', details: error.message });
  }
});

// PUT /appointments/:id — Update appointment (status, scheduledTime, description)
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { title, description, scheduledAt, duration, status, reminderTime } = req.body;
    const appointment = await Appointment.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    const oldStatus = appointment.status;

    if (title !== undefined) appointment.title = title;
    if (description !== undefined) appointment.description = description;
    if (scheduledAt !== undefined) {
      appointment.scheduledAt = new Date(scheduledAt);
      appointment.reminded = false; // Reset reminder on rescheduled
    }
    if (duration !== undefined) appointment.duration = duration;
    if (reminderTime !== undefined) appointment.reminderTime = reminderTime;
    if (status !== undefined) {
      const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      appointment.status = status;
    }

    await appointment.save();

    // Notify assignee about the update
    let titleText = 'Appointment Updated 📅';
    let msgText = `Appointment "${appointment.title}" details were updated.`;

    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      titleText = 'Appointment Cancelled ❌';
      msgText = `Appointment "${appointment.title}" was cancelled.`;
    } else if (status === 'confirmed' && oldStatus !== 'confirmed') {
      titleText = 'Appointment Confirmed ✅';
      msgText = `Appointment "${appointment.title}" is now confirmed.`;
    } else if (scheduledAt !== undefined) {
      titleText = 'Appointment Rescheduled ⏰';
      msgText = `Appointment "${appointment.title}" has been rescheduled to ${new Date(scheduledAt).toLocaleString()}.`;
    }

    await createNotification({
      userId: appointment.assignedTo,
      organizationId: req.organizationId,
      type: 'appointment',
      title: titleText,
      message: msgText,
      link: '/dashboard/contacts',
      metadata: { appointmentId: appointment._id }
    });

    res.json({ success: true, data: { appointment }, message: 'Appointment updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update appointment', details: error.message });
  }
});

// DELETE /appointments/:id — Delete appointment
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    res.json({ success: true, message: 'Appointment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete appointment', details: error.message });
  }
});

module.exports = router;
