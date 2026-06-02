const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const BotFlow = require('../models/BotFlow');
const WhatsAppAccount = require('../models/WhatsAppAccount');

async function run() {
  try {
    await connectDB();
    const user = await User.findOne({ email: 'princegajera0506@gmail.com' });
    if (!user) {
      console.log('User not found!');
      await disconnectDB();
      return;
    }
    console.log('User found:', { id: user._id, email: user.email, organizationId: user.organizationId });

    const account = await WhatsAppAccount.findOne({ userId: user._id });
    if (account) {
      console.log('WhatsApp Account info:', {
        _id: account._id,
        phoneNumberId: account.phoneNumberId,
        wabaId: account.wabaId,
        isActive: account.isActive
      });
    } else {
      console.log('No WhatsApp account found for this user.');
    }

    const flows = await BotFlow.find({ userId: user._id });
    console.log(`Found ${flows.length} bot flows:`);
    flows.forEach(flow => {
      console.log(`\nFlow ID: ${flow._id}`);
      console.log(`Name: ${flow.name}`);
      console.log(`IsActive: ${flow.isActive}`);
      console.log(`Trigger:`, JSON.stringify(flow.trigger, null, 2));
      console.log(`Nodes:`, JSON.stringify(flow.nodes, null, 2));
      console.log(`Edges:`, JSON.stringify(flow.edges, null, 2));
    });

    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
