const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../../.env');
console.log('Checking .env file existence at:', envPath);
console.log('Exists:', fs.existsSync(envPath));

require('dotenv').config({ path: envPath });

console.log('Loaded env values:');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
console.log('- META_ACCESS_TOKEN:', process.env.META_ACCESS_TOKEN ? 'SET' : 'NOT SET');
console.log('- META_PHONE_NUMBER_ID:', process.env.META_PHONE_NUMBER_ID);
console.log('- META_WABA_ID:', process.env.META_WABA_ID);

const WhatsAppAccount = require('../models/WhatsAppAccount');
const User = require('../models/User');
const { encryptField } = require('../services/encryption');

const email = process.argv[2] || 'devaniparth27@gmail.com';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI is not set in .env');
    process.exit(1);
  }

  const token = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const wabaId = process.env.META_WABA_ID;

  if (!token || token === 'your_meta_permanent_access_token' || !phoneNumberId || !wabaId) {
    console.error('ERROR: Please make sure META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, and META_WABA_ID are configured in your .env file.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected.');

  console.log(`Searching for user with email: ${email}`);
  const user = await User.findOne({ email, isDeleted: { $ne: true } });
  if (!user) {
    console.error(`ERROR: User not found with email: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (ID: ${user._id})`);

  let account = await WhatsAppAccount.findOne({ userId: user._id });
  const encryptedToken = encryptField(token);

  if (account) {
    console.log(`Updating existing WhatsApp account (WABA ID: ${account.wabaId}) with real credentials...`);
    account.phoneNumber = '+15555555555'; // Default or temporary phone number
    account.phoneNumberId = phoneNumberId;
    account.wabaId = wabaId;
    account.accessToken = encryptedToken;
    account.displayName = 'Real WhatsApp Account';
    account.isActive = true;
    await account.save();
  } else {
    console.log('Creating new WhatsApp account with real credentials...');
    account = await WhatsAppAccount.create({
      userId: user._id,
      phoneNumber: '+15555555555',
      phoneNumberId,
      accessToken: encryptedToken,
      wabaId,
      displayName: 'Real WhatsApp Account',
      isActive: true,
      webhookVerified: true
    });
  }

  console.log('✅ WhatsApp Account updated/created successfully with real credentials!');
  console.log(`- User: ${user.email}`);
  console.log(`- WABA ID: ${wabaId}`);
  console.log(`- Phone Number ID: ${phoneNumberId}`);
  
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
