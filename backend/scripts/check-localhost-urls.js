const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Message = require('../models/Message');

async function main() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to Mongo.');

  const localhostMsgs = await Message.find({ 'content.mediaUrl': { $regex: 'localhost' } }).limit(5).lean();
  console.log(`Found ${localhostMsgs.length} messages containing 'localhost' in mediaUrl:`);
  console.log(JSON.stringify(localhostMsgs, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
