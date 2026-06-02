const { connectDB, disconnectDB } = require('../config/db');
const ApiLog = require('../models/ApiLog');

async function run() {
  try {
    await connectDB();
    console.log('Fetching the last 20 API logs...');
    
    const logs = await ApiLog.find({}).sort('-createdAt').limit(20).lean();
    console.log(`Found ${logs.length} logs:`);

    logs.forEach((log, idx) => {
      console.log(`\n--- Log #${idx + 1} ---`);
      console.log(`Timestamp: ${log.createdAt}`);
      console.log(`Type: ${log.type}`);
      console.log(`Method: ${log.method}`);
      console.log(`Url: ${log.url}`);
      console.log(`Status Code: ${log.statusCode}`);
      console.log(`IP: ${log.ip}`);
      console.log(`Request Body:`, JSON.stringify(log.requestBody, null, 2));
      console.log(`Response Body:`, JSON.stringify(log.responseBody, null, 2));
    });

    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
