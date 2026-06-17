const router = require('express').Router();
const CallLog = require('../models/CallLog');
const DeviceContact = require('../models/DeviceContact');
const DeviceToken = require('../models/DeviceToken');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// GET /telephony/call-logs — list synced call logs for the user/organization
router.get('/call-logs', async (req, res) => {
  try {
    const orgId = req.organizationId || req.user.organizationId;
    const query = { organizationId: orgId };
    
    // Non-admins (agents) can only see their own call logs
    if (req.user.role === 'agent') {
      query.userId = req.user._id;
    }

    const { page = 1, limit = 50, search, callType } = req.query;
    
    if (callType) {
      query.callType = callType;
    }
    
    if (search) {
      const searchRegex = new RegExp(search.replace(/\D/g, '') || search, 'i');
      query.$or = [
        { phone: searchRegex },
        { name: new RegExp(search, 'i') }
      ];
    }

    const [logs, total] = await Promise.all([
      CallLog.find(query)
        .populate('userId', 'name email')
        .sort('-timestamp')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      CallLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch call logs' });
  }
});

// POST /telephony/call-logs
router.post('/call-logs', async (req, res) => {
  try {
    const { logs } = req.body;
    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ success: false, error: 'Logs array is required', code: 'INVALID_BODY' });
    }

    const orgId = req.organizationId || req.user.organizationId;
    const mappedLogs = logs.map((log) => ({
      userId: req.user._id,
      organizationId: orgId,
      phone: log.phone ? log.phone.replace(/\D/g, '') : '',
      name: log.name || '',
      duration: parseInt(log.duration) || 0,
      timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      callType: log.callType || 'unknown',
    })).filter(log => log.phone);

    if (mappedLogs.length > 0) {
      const ops = mappedLogs.map((log) => ({
        updateOne: {
          filter: {
            userId: log.userId,
            phone: log.phone,
            timestamp: log.timestamp
          },
          update: { $setOnInsert: log },
          upsert: true
        }
      }));

      await CallLog.bulkWrite(ops, { ordered: false }).catch((err) => {
        console.warn('CallLog bulkWrite partial warning:', err.message);
      });
    }

    res.json({ success: true, message: `${mappedLogs.length} call logs synchronized successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Call logs synchronization failed', code: 'SYNC_ERROR' });
  }
});

// POST /telephony/device-contacts
router.post('/device-contacts', async (req, res) => {
  try {
    const { contacts } = req.body;
    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ success: false, error: 'Contacts array is required', code: 'INVALID_BODY' });
    }

    const orgId = req.organizationId || req.user.organizationId;
    const ops = contacts.map((contact) => {
      const cleanPhone = contact.phone ? contact.phone.replace(/\D/g, '') : '';
      return {
        updateOne: {
          filter: { userId: req.user._id, phone: cleanPhone },
          update: {
            $set: {
              organizationId: orgId,
              name: contact.name || '',
              email: contact.email || '',
              syncTimestamp: new Date(),
            },
          },
          upsert: true,
        },
      };
    }).filter(op => op.updateOne.filter.phone);

    if (ops.length > 0) {
      await DeviceContact.bulkWrite(ops, { ordered: false });
    }

    res.json({ success: true, message: `${ops.length} device contacts synchronized successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Device contacts synchronization failed', code: 'SYNC_ERROR' });
  }
});

// POST /telephony/device-tokens
router.post('/device-tokens', async (req, res) => {
  try {
    const { token, platform = 'android' } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required', code: 'INVALID_BODY' });
    }

    const orgId = req.organizationId || req.user.organizationId;
    await DeviceToken.updateOne(
      { userId: req.user._id, token },
      {
        $set: {
          organizationId: orgId,
          platform,
          lastActive: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ success: true, message: 'Device token registered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Device token registration failed', code: 'REGISTRATION_ERROR' });
  }
});

module.exports = router;
