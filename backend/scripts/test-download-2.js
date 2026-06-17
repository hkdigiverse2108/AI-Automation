const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const WhatsAppAccount = require('../models/WhatsAppAccount');
const { decryptField } = require('../services/encryption');
const whatsapp = require('../services/whatsapp');

async function main() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected.');

  const acc = await WhatsAppAccount.findOne({ isActive: true });
  if (!acc) {
    console.error('No active WhatsApp account found.');
    await mongoose.disconnect();
    return;
  }

  const token = decryptField(acc.accessToken);
  const mediaId = '1319888476421858';
  const destPath = path.join(__dirname, '..', 'uploads', 'test-incoming-2.jpg');

  console.log(`Attempting to download media ID ${mediaId} to ${destPath}...`);
  const result = await whatsapp.downloadMedia(mediaId, token, destPath);
  console.log('Result:', result);

  await mongoose.disconnect();
}

main().catch(console.error);
