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

// GET /api/analytics/reports — Comprehensive reporting endpoint for Daily, Weekly, Monthly
router.get('/reports', verifyToken, checkFeatureAccess('analytics'), async (req, res) => {
  try {
    const userId = req.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const period = req.query.period || 'weekly'; // 'daily', 'weekly', 'monthly'

    const now = new Date();
    let since, prevSince, prevUntil, bucketType;

    if (period === 'daily') {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      prevSince = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      prevUntil = since;
      bucketType = 'hour';
    } else if (period === 'monthly') {
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      prevSince = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      prevUntil = since;
      bucketType = 'day';
    } else {
      // 'weekly' default
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevSince = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      prevUntil = since;
      bucketType = 'day';
    }

    // Parallel fetch current & previous period counts
    const [
      sentCount,
      deliveredOnlyCount,
      readCount,
      failedCount,
      inboundCount,
      activeContactIds,
      prevSentCount,
      prevDeliveredOnlyCount,
      prevReadCount,
      prevFailedCount,
      prevInboundCount,
      prevActiveContactIds,
    ] = await Promise.all([
      // Current period
      Message.countDocuments({ userId: userObjectId, direction: 'outbound', createdAt: { $gte: since } }),
      Message.countDocuments({ userId: userObjectId, direction: 'outbound', status: 'delivered', createdAt: { $gte: since } }),
      Message.countDocuments({ userId: userObjectId, direction: 'outbound', status: 'read', createdAt: { $gte: since } }),
      Message.countDocuments({ userId: userObjectId, direction: 'outbound', status: 'failed', createdAt: { $gte: since } }),
      Message.countDocuments({ userId: userObjectId, direction: 'inbound', createdAt: { $gte: since } }),
      Message.distinct('contactId', { userId: userObjectId, createdAt: { $gte: since } }),
      // Previous period for comparison
      Message.countDocuments({ userId: userObjectId, direction: 'outbound', createdAt: { $gte: prevSince, $lt: prevUntil } }),
      Message.countDocuments({ userId: userObjectId, direction: 'outbound', status: 'delivered', createdAt: { $gte: prevSince, $lt: prevUntil } }),
      Message.countDocuments({ userId: userObjectId, direction: 'outbound', status: 'read', createdAt: { $gte: prevSince, $lt: prevUntil } }),
      Message.countDocuments({ userId: userObjectId, direction: 'outbound', status: 'failed', createdAt: { $gte: prevSince, $lt: prevUntil } }),
      Message.countDocuments({ userId: userObjectId, direction: 'inbound', createdAt: { $gte: prevSince, $lt: prevUntil } }),
      Message.distinct('contactId', { userId: userObjectId, createdAt: { $gte: prevSince, $lt: prevUntil } }),
    ]);

    // Total delivered = delivered + read
    const deliveredCount = deliveredOnlyCount + readCount;
    const prevDeliveredCount = prevDeliveredOnlyCount + prevReadCount;

    // Rates
    const deliveryRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 0;
    const readRate = deliveredCount > 0 ? Math.round((readCount / deliveredCount) * 100) : (sentCount > 0 ? Math.round((readCount / sentCount) * 100) : 0);
    const replyRate = sentCount > 0 ? Math.min(100, Math.round((inboundCount / sentCount) * 100)) : 0;
    const activeUsers = activeContactIds.length;

    const prevReplyRate = prevSentCount > 0 ? Math.min(100, Math.round((prevInboundCount / prevSentCount) * 100)) : 0;
    const prevActiveUsers = prevActiveContactIds.length;

    // Calculate Response Time (average duration between customer message and agent/bot response)
    const messagesForResp = await Message.find({
      userId: userObjectId,
      createdAt: { $gte: since }
    })
      .select('conversationId direction createdAt')
      .sort({ conversationId: 1, createdAt: 1 })
      .limit(1000)
      .lean();

    let totalResponseTimeSec = 0;
    let responseCount = 0;
    const lastInboundTimeByConv = {};

    for (const msg of messagesForResp) {
      const convId = msg.conversationId?.toString();
      if (!convId) continue;
      const msgTime = new Date(msg.createdAt).getTime();

      if (msg.direction === 'inbound') {
        lastInboundTimeByConv[convId] = msgTime;
      } else if (msg.direction === 'outbound' && lastInboundTimeByConv[convId]) {
        const diffSec = (msgTime - lastInboundTimeByConv[convId]) / 1000;
        if (diffSec >= 0 && diffSec <= 86400) {
          totalResponseTimeSec += diffSec;
          responseCount++;
        }
        delete lastInboundTimeByConv[convId];
      }
    }

    const avgResponseTimeSec = responseCount > 0 ? Math.round(totalResponseTimeSec / responseCount) : 0;
    const formatDuration = (sec) => {
      if (!sec || sec <= 0) return responseCount === 0 ? 'N/A' : '< 1m';
      if (sec < 60) return `${sec}s`;
      const mins = Math.floor(sec / 60);
      const remSec = sec % 60;
      if (mins < 60) return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    };

    const formattedResponseTime = formatDuration(avgResponseTimeSec);

    // Timeline series generation
    let timeline = [];
    if (bucketType === 'hour') {
      const hourlyAgg = await Message.aggregate([
        { $match: { userId: userObjectId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              hour: { $dateToString: { format: '%Y-%m-%dT%H', date: '$createdAt' } },
              direction: '$direction',
              status: '$status'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      const hourMap = {};
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        const isoKey = d.toISOString().slice(0, 13);
        const label = `${String(d.getHours()).padStart(2, '0')}:00`;
        hourMap[isoKey] = {
          label,
          fullDate: `${d.toLocaleDateString()} ${label}`,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          inbound: 0
        };
      }

      hourlyAgg.forEach(item => {
        const hKey = item._id.hour;
        if (hourMap[hKey]) {
          if (item._id.direction === 'outbound') {
            hourMap[hKey].sent += item.count;
            if (item._id.status === 'delivered') hourMap[hKey].delivered += item.count;
            if (item._id.status === 'read') {
              hourMap[hKey].delivered += item.count;
              hourMap[hKey].read += item.count;
            }
            if (item._id.status === 'failed') hourMap[hKey].failed += item.count;
          } else if (item._id.direction === 'inbound') {
            hourMap[hKey].inbound += item.count;
          }
        }
      });
      timeline = Object.values(hourMap);
    } else {
      const daysCount = period === 'monthly' ? 30 : 7;
      const dailyAgg = await Message.aggregate([
        { $match: { userId: userObjectId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              direction: '$direction',
              status: '$status'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      const dayMap = {};
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        const label = period === 'monthly' ? key.slice(5) : `${dayNames[d.getDay()]} ${d.getDate()}`;
        dayMap[key] = {
          label,
          fullDate: key,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          inbound: 0
        };
      }

      dailyAgg.forEach(item => {
        const dKey = item._id.date;
        if (dayMap[dKey]) {
          if (item._id.direction === 'outbound') {
            dayMap[dKey].sent += item.count;
            if (item._id.status === 'delivered') dayMap[dKey].delivered += item.count;
            if (item._id.status === 'read') {
              dayMap[dKey].delivered += item.count;
              dayMap[dKey].read += item.count;
            }
            if (item._id.status === 'failed') dayMap[dKey].failed += item.count;
          } else if (item._id.direction === 'inbound') {
            dayMap[dKey].inbound += item.count;
          }
        }
      });
      timeline = Object.values(dayMap);
    }

    const calcChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? '+100%' : '0%';
      const pct = Math.round(((curr - prev) / prev) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    };

    res.json({
      success: true,
      data: {
        period,
        metrics: {
          sent: sentCount,
          delivered: deliveredCount,
          read: readCount,
          failed: failedCount,
          replyRate: replyRate,
          inbound: inboundCount,
          responseTime: formattedResponseTime,
          responseTimeSeconds: avgResponseTimeSec,
          activeUsers: activeUsers,
          deliveryRate: deliveryRate,
          readRate: readRate,
        },
        comparisons: {
          sentChange: calcChange(sentCount, prevSentCount),
          deliveredChange: calcChange(deliveredCount, prevDeliveredCount),
          readChange: calcChange(readCount, prevReadCount),
          failedChange: calcChange(failedCount, prevFailedCount),
          replyRateChange: calcChange(replyRate, prevReplyRate),
          activeUsersChange: calcChange(activeUsers, prevActiveUsers),
        },
        timeline,
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
