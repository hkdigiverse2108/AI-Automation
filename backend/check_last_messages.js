const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/db');
const ApiLog = require('./models/ApiLog');
const WhatsAppAccount = require('./models/WhatsAppAccount');

async function run() {
  await connectDB();
  try {
    const accounts = await WhatsAppAccount.find({});
    console.log('\n--- WhatsApp Accounts ---');
    accounts.forEach(acc => {
      console.log(`User: ${acc.userId}, Phone: ${acc.phoneNumberId}, Active: ${acc.isActive}, TokenPrefix: ${acc.accessToken ? acc.accessToken.substring(0, 15) : 'none'}`);
    });

    const logs = await ApiLog.find({ type: 'api_call', statusCode: { $ne: 200 } })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    console.log('\n--- Non-200 API Call Logs ---');
    logs.forEach(l => {
      console.log(`[${l.method}] ${l.url} - Status: ${l.statusCode}`);
      console.log(`Details:`, l.details);
      console.log(`Request:`, JSON.stringify(l.requestBody));
      console.log(`Response:`, JSON.stringify(l.responseBody));
      console.log('-----------------------------');
    });
  } catch (err) {
    console.error(err);
  } finally {
    await disconnectDB();
  }
}

run();
