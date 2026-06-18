const { connectDB, disconnectDB } = require('../config/db');
const CallLog = require('../models/CallLog');

async function run() {
  try {
    await connectDB();
    console.log('Querying call logs for phone +918780564463 with user/org IDs...');
    const logs = await CallLog.find({ phone: '918780564463' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    logs.forEach(log => {
      console.log({
        id: log._id,
        phone: log.phone,
        userId: log.userId,
        organizationId: log.organizationId,
        timestampMs: log.timestamp ? log.timestamp.getTime() : null,
        createdAt: log.createdAt
      });
    });
    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
