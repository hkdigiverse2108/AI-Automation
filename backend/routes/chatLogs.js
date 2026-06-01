const router = require('express').Router();
const ApiLog = require('../models/ApiLog');
const Message = require('../models/Message');
const { verifyToken } = require('../middleware/auth');
const { getOekForUser, decryptContact, decryptMessage } = require('../services/oekService');

router.use(verifyToken);

// GET /api/chat-logs — fetch log categories
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { logType = 'text', page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (logType === 'text') {
      // Pull actual conversation messages
      const total = await Message.countDocuments({ userId });
      const logs = await Message.find({ userId })
        .sort('-timestamp')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('contactId', 'name phone')
        .lean();

      const rawOek = await getOekForUser(userId);

      const decryptedLogs = logs.map(l => {
        const contact = l.contactId ? decryptContact(l.contactId, rawOek) : null;
        const msg = decryptMessage(l, rawOek);

        return {
          id: msg._id,
          contactName: contact?.name || 'Unknown',
          contactPhone: contact?.phone || '',
          direction: msg.direction,
          type: msg.type,
          content: msg.content?.text || msg.content?.caption || '[media]',
          status: msg.status,
          timestamp: msg.timestamp || msg.createdAt,
        };
      });

      return res.json({
        success: true,
        data: {
          logs: decryptedLogs,
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
        }
      });
    }

    if (logType === 'button') {
      // Pull button click logs
      const query = { userId, type: 'button_response' };
      const total = await ApiLog.countDocuments(query);
      const logs = await ApiLog.find(query)
        .sort('-timestamp')
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      return res.json({
        success: true,
        data: {
          logs: logs.map(l => ({
            id: l._id,
            url: l.url,
            statusCode: l.statusCode,
            details: l.details || 'Button Clicked',
            requestBody: l.requestBody,
            responseBody: l.responseBody,
            timestamp: l.timestamp || l.createdAt,
          })),
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
        }
      });
    }

    if (logType === 'api') {
      // Pull API call/webhook logs
      const query = { userId, type: { $in: ['webhook_incoming', 'api_call'] } };
      const total = await ApiLog.countDocuments(query);
      const logs = await ApiLog.find(query)
        .sort('-timestamp')
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      return res.json({
        success: true,
        data: {
          logs: logs.map(l => ({
            id: l._id,
            type: l.type,
            method: l.method,
            url: l.url,
            requestBody: l.requestBody,
            responseBody: l.responseBody,
            statusCode: l.statusCode,
            ip: l.ip,
            timestamp: l.timestamp || l.createdAt,
          })),
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
        }
      });
    }

    res.status(400).json({ success: false, error: 'Invalid log type requested' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch logs data' });
  }
});

module.exports = router;
