const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('./models/User');
const Template = require('./models/Template');
const BotFlow = require('./models/BotFlow');
const ReplyTrigger = require('./models/ReplyTrigger');

async function debug() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const prince = await User.findOne({ email: 'princegajera0506@gmail.com' });
  if (!prince) {
    console.log('Prince user not found');
    await mongoose.disconnect();
    return;
  }

  console.log('\n--- PRINCE TEMPLATES ---');
  const templates = await Template.find({ userId: prince._id });
  for (const t of templates) {
    console.log(`ID: ${t._id}`);
    console.log(`Name: ${t.name}`);
    console.log(`Category: ${t.category}`);
    console.log(`Status: ${t.status}`);
    console.log(`Components: ${JSON.stringify(t.components, null, 2)}`);
    console.log('------------------------');
  }

  console.log('\n--- PRINCE BOT FLOWS ---');
  const flows = await BotFlow.find({ userId: prince._id });
  for (const f of flows) {
    console.log(`ID: ${f._id}`);
    console.log(`Name: ${f.name}`);
    console.log(`IsActive: ${f.isActive}`);
    console.log(`Trigger: ${JSON.stringify(f.trigger, null, 2)}`);
    console.log(`Entry Node ID: ${f.entryNodeId}`);
    console.log(`Nodes: ${JSON.stringify(f.nodes, null, 2)}`);
    console.log('------------------------');
  }

  console.log('\n--- PRINCE REPLY TRIGGERS ---');
  const triggers = await ReplyTrigger.find({ userId: prince._id });
  for (const tr of triggers) {
    console.log(`ID: ${tr._id}`);
    console.log(`TriggerText: "${tr.triggerText}"`);
    console.log(`ReplyText: "${tr.replyText}"`);
    console.log(`TemplateIds: ${JSON.stringify(tr.templateIds)}`);
    console.log(`IsFallback: ${tr.isFallback}`);
    console.log('------------------------');
  }

  await mongoose.disconnect();
}

debug();
