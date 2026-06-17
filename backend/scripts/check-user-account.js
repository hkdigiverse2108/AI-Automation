const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const WhatsAppAccount = require('../models/WhatsAppAccount');
const { decryptField } = require('../services/encryption');

async function main() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected.');

  const accounts = await WhatsAppAccount.find({}).lean();
  console.log('\n--- ALL WHATSAPP ACCOUNTS ---');
  for (const acc of accounts) {
    let decToken = '';
    try {
      decToken = decryptField(acc.accessToken);
    } catch (err) {
      decToken = 'DECRYPTION_FAILED: ' + err.message;
    }
    console.log(`Account ID: ${acc._id}`);
    console.log(`User ID: ${acc.userId}`);
    console.log(`Phone: ${acc.phoneNumber}`);
    console.log(`Token: "${decToken}"`);
    console.log(`Is Active: ${acc.isActive}`);
    console.log('-----------------------------');
  }

  await mongoose.disconnect();
}

main().catch(console.error);
