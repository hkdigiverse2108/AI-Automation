const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Campaign = require('../models/Campaign');
const checkFeatureAccess = require('../middleware/checkFeatureAccess');

// GET /api/analytics/overview — Aggregated dashboard metrics
router.get('/overview', verifyToken, checkFeatureAccess('analytics'), async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      totalContacts,
      newContacts30d,
      totalConversations,
      totalMessages,
      messagesSent7d,
      messagesReceived7d,
      deliveredCount,
      readCount,
      repliedCount,
    ] = await Promise.all([
      Contact.countDocuments({ userId, isDeleted: { $ne: true } }),
      Contact.countDocuments({ userId, isDeleted: { $ne: true }, createdAt: { $gte: thirtyDaysAgo } }),
      Conversation.countDocuments({ userId }),
      Message.countDocuments({ userId }),
      Message.countDocuments({ userId, direction: 'outbound', createdAt: { $gte: sevenDaysAgo } }),
      Message.countDocuments({ userId, direction: 'inbound', createdAt: { $gte: sevenDaysAgo } }),
      Message.countDocuments({ userId, direction: 'outbound', status: { $in: ['delivered', 'read'] } }),
      Message.countDocuments({ userId, direction: 'outbound', status: 'read' }),
      Message.countDocuments({ userId, direction: 'inbound' }),
    ]);

    const totalSent = await Message.countDocuments({ userId, direction: 'outbound' });
    const deliveryRate = totalSent > 0 ? Math.round((deliveredCount / totalSent) * 100) : 0;
    const readRate = totalSent > 0 ? Math.round((readCount / totalSent) * 100) : 0;
    const replyRate = totalSent > 0 ? Math.round((repliedCount / totalSent) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalContacts,
        newContacts30d,
        totalConversations,
        totalMessages,
        messagesSent7d,
        messagesReceived7d,
        deliveryRate,
        readRate,
        replyRate,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/message-trends — Time-series message data
router.get('/message-trends', verifyToken, checkFeatureAccess('analytics'), async (req, res) => {
  try {
    const userId = req.userId;
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            direction: '$direction'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ];

    const raw = await Message.aggregate(pipeline);

    // Pivot into { date, sent, received } format
    const dateMap = {};
    raw.forEach(r => {
      if (!dateMap[r._id.date]) {
        dateMap[r._id.date] = { date: r._id.date, sent: 0, received: 0 };
      }
      if (r._id.direction === 'outbound') dateMap[r._id.date].sent = r.count;
      else dateMap[r._id.date].received = r.count;
    });

    // Fill missing dates
    const result = [];
    for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      result.push(dateMap[key] || { date: key, sent: 0, received: 0 });
    }

    res.json({ success: true, data: { trends: result } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/contact-growth — Contact acquisition over time
router.get('/contact-growth', verifyToken, checkFeatureAccess('analytics'), async (req, res) => {
  try {
    const userId = req.userId;
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: { $ne: true }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const raw = await Contact.aggregate(pipeline);

    // Build cumulative series
    let cumulative = 0;
    const beforeCount = await Contact.countDocuments({ userId, isDeleted: { $ne: true }, createdAt: { $lt: since } });
    cumulative = beforeCount;

    const result = [];
    for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const found = raw.find(r => r._id === key);
      cumulative += (found?.count || 0);
      result.push({ date: key, newContacts: found?.count || 0, total: cumulative });
    }

    res.json({ success: true, data: { growth: result } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/campaign-performance — Campaign metrics breakdown
router.get('/campaign-performance', verifyToken, checkFeatureAccess('analytics'), async (req, res) => {
  try {
    const userId = req.userId;

    const campaigns = await Campaign.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const performance = campaigns.map(c => {
      const sent = c.stats?.sent || 0;
      const delivered = c.stats?.delivered || 0;
      const read = c.stats?.read || 0;
      const failed = c.stats?.failed || 0;
      return {
        name: c.name,
        status: c.status,
        totalRecipients: c.audience?.totalCount || 0,
        sent,
        delivered,
        read,
        failed,
        deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
        readRate: sent > 0 ? Math.round((read / sent) * 100) : 0,
        createdAt: c.createdAt,
      };
    });

    res.json({ success: true, data: { campaigns: performance } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/hourly-activity — Active hours heatmap data
router.get('/hourly-activity', verifyToken, checkFeatureAccess('analytics'), async (req, res) => {
  try {
    const userId = req.userId;
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: '$createdAt' },
            hour: { $hour: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      }
    ];

    const raw = await Message.aggregate(pipeline);

    // Build 7×24 grid (dayOfWeek 1=Sun...7=Sat, hour 0-23)
    const days_labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmap = [];
    for (let day = 1; day <= 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const found = raw.find(r => r._id.dayOfWeek === day && r._id.hour === hour);
        heatmap.push({
          day: days_labels[day - 1],
          hour,
          count: found?.count || 0,
        });
      }
    }

    res.json({ success: true, data: { heatmap } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/conversation-stats — Bot vs Human ratio & status breakdown
router.get('/conversation-stats', verifyToken, checkFeatureAccess('analytics'), async (req, res) => {
  try {
    const userId = req.userId;

    const [byStatus, bySource] = await Promise.all([
      Conversation.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Conversation.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]),
    ]);

    res.json({
      success: true,
      data: {
        byStatus: byStatus.map(s => ({ name: s._id || 'unknown', value: s.count })),
        bySource: bySource.map(s => ({ name: s._id || 'direct', value: s.count })),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
