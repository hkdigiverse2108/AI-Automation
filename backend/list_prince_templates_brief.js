const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('./models/User');
const Template = require('./models/Template');
const BotFlow = require('./models/BotFlow');

async function debug() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const prince = await User.findOne({ email: 'princegajera0506@gmail.com' });
  const hk = await User.findOne({ email: 'hk@gmail.com' });

  if (prince) {
    console.log('\n--- PRINCE TEMPLATES (Brief) ---');
    const templates = await Template.find({ userId: prince._id });
    for (const t of templates) {
      console.log(`- Template: Name="${t.name}" ID=${t._id} Status=${t.status}`);
      t.components.forEach(c => {
        if (c.type === 'BODY') console.log(`  Body text: "${c.text}"`);
        if (c.type === 'BUTTONS') console.log(`  Buttons: ${JSON.stringify(c.buttons)}`);
      });
    }

    console.log('\n--- PRINCE BOT FLOWS (Brief) ---');
    const flows = await BotFlow.find({ userId: prince._id });
    for (const f of flows) {
      console.log(`- Flow: Name="${f.name}" ID=${f._id} IsActive=${f.isActive} TriggerType=${f.trigger?.type} Keywords=${JSON.stringify(f.trigger?.keywords)}`);
    }
  }

  if (hk) {
    console.log('\n--- HK TEMPLATES (Brief) ---');
    const templates = await Template.find({ userId: hk._id });
    for (const t of templates) {
      console.log(`- Template: Name="${t.name}" ID=${t._id} Status=${t.status}`);
      t.components.forEach(c => {
        if (c.type === 'BODY') console.log(`  Body text: "${c.text}"`);
        if (c.type === 'BUTTONS') console.log(`  Buttons: ${JSON.stringify(c.buttons)}`);
      });
    }

    console.log('\n--- HK BOT FLOWS (Brief) ---');
    const flows = await BotFlow.find({ userId: hk._id });
    for (const f of flows) {
      console.log(`- Flow: Name="${f.name}" ID=${f._id} IsActive=${f.isActive} TriggerType=${f.trigger?.type} Keywords=${JSON.stringify(f.trigger?.keywords)}`);
    }
  }

  await mongoose.disconnect();
}

debug();
