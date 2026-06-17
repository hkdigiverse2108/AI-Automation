const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Message = require('../models/Message');

async function main() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to Mongo.');

  const latestMsg = await Message.findOne({ type: 'image', direction: 'inbound' }).sort('-createdAt').lean();
  if (latestMsg) {
    console.log('LATEST INBOUND IMAGE MESSAGE:');
    console.log(JSON.stringify(latestMsg, null, 2));
  } else {
    console.log('No inbound image messages found.');
  }

  await mongoose.disconnect();
}

main().catch(console.error);
