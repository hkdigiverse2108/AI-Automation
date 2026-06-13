const router = require('express').Router();
const CallLog = require('../models/CallLog');
const DeviceContact = require('../models/DeviceContact');
const DeviceToken = require('../models/DeviceToken');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

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
      await CallLog.insertMany(mappedLogs, { ordered: false }).catch((err) => {
        // ignore duplicate key or minor bulk insertion warnings
        console.warn('CallLog bulk insertion partial warning:', err.message);
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
