const { connectDB, disconnectDB } = require('../config/db');
const CallLog = require('../models/CallLog');

async function run() {
  try {
    await connectDB();
    console.log('Querying call logs...');
    const logs = await CallLog.find()
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    console.log(`Found ${logs.length} recent call logs:`);
    logs.forEach(log => {
      console.log({
        id: log._id,
        phone: log.phone,
        name: log.name,
        duration: log.duration,
        timestamp: log.timestamp,
        timestampMs: log.timestamp ? log.timestamp.getTime() : null,
        callType: log.callType,
        createdAt: log.createdAt
      });
    });
    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
