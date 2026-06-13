const { connectDB, disconnectDB } = require('../config/db');
const ApiLog = require('../models/ApiLog');
const Message = require('../models/Message');

async function run() {
  try {
    await connectDB();
    
    console.log('--- LATEST FAILED MESSAGES ---');
    const failedMessages = await Message.find({ status: 'failed' })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    failedMessages.forEach(msg => {
      console.log(`\nMessage ID: ${msg._id}`);
      console.log(`Direction: ${msg.direction}`);
      console.log(`Type: ${msg.type}`);
      console.log(`Content:`, JSON.stringify(msg.content));
      console.log(`Error Details:`, JSON.stringify(msg.errorDetails));
      console.log(`Updated At: ${msg.updatedAt}`);
    });

    console.log('\n--- LATEST API LOGS ---');
    const logs = await ApiLog.find({ statusCode: { $ne: 200 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    logs.forEach(log => {
      console.log(`\nLog ID: ${log._id}`);
      console.log(`URL: ${log.url}`);
      console.log(`Status Code: ${log.statusCode}`);
      console.log(`Request Body:`, JSON.stringify(log.requestBody));
      console.log(`Response Body:`, JSON.stringify(log.responseBody));
      console.log(`Created At: ${log.createdAt}`);
    });

    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
