const { connectDB, disconnectDB } = require('../config/db');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const User = require('../models/User');

async function run() {
  try {
    await connectDB();
    console.log('Fetching WhatsAppAccounts...');
    const accounts = await WhatsAppAccount.find({});
    console.log(`Found ${accounts.length} WhatsApp Accounts:`);
    for (const acc of accounts) {
      const user = await User.findById(acc.userId);
      console.log(`ID: ${acc._id}, Phone: ${acc.phoneNumber || acc.phone}, Name: ${acc.name}, User: ${user ? user.email : 'Unknown'}`);
    }
    await disconnectDB();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
