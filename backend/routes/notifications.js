const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Notification = require('../models/Notification');

// GET /api/notifications — List notifications with pagination
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = req.query.filter; // 'unread', 'read', or undefined for all
    const type = req.query.type;
    const search = req.query.search;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id, organization: req.organizationId };
    if (filter === 'unread') query.isRead = false;
    else if (filter === 'read') query.isRead = true;

    if (type) {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user._id, organization: req.organizationId, isRead: false }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        total,
        unreadCount,
        page,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/notifications/unread-count — Badge count
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, organization: req.organizationId, isRead: false });
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/notifications/:id/read — Mark single notification as read
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, organization: req.organizationId },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.json({ success: true, data: notif });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/notifications/read-all — Mark all as read
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, organization: req.organizationId, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/notifications/delete-all — Delete all notifications for the user
router.delete('/delete-all', verifyToken, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id, organization: req.organizationId });
    res.json({ success: true, message: 'All notifications deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/notifications/:id — Delete a notification
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const notif = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
      organization: req.organizationId
    });
    if (!notif) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
