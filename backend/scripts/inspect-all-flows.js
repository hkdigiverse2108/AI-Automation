const { connectDB } = require('../config/db');
const BotFlow = require('../models/BotFlow');
const User = require('../models/User');
const Message = require('../models/Message');
const WhatsAppAccount = require('../models/WhatsAppAccount');

async function main() {
  try {
    await connectDB();

    console.log('=== USERS & WA ACCOUNTS ===');
    const users = await User.find({}).lean();
    for (const u of users) {
      const wa = await WhatsAppAccount.findOne({ userId: u._id });
      console.log(`User: ${u.email} (${u._id}), WA: ${wa ? wa.phoneNumber || wa.phone || wa.phoneNumberId : 'none'}, active: ${wa?.isActive}`);
    }

    console.log('\n=== ALL BOT FLOWS ===');
    const flows = await BotFlow.find({}).lean();
    for (const f of flows) {
      console.log(`\nFlow ID: ${f._id} | Name: "${f.name}" | User: ${f.userId} | Active: ${f.isActive} | Nodes Count: ${f.nodes?.length || 0}`);
      console.log(`Trigger:`, f.trigger);
      if (f.nodes && f.nodes.length > 0) {
        console.log(`First 3 nodes:`);
        f.nodes.slice(0, 3).forEach(n => {
          console.log(`  - [${n.type}] ID: ${n.id}, label: ${n.data?.label || n.data?.text || n.name}`);
        });
      }
    }

    console.log('\n=== LAST 10 MESSAGES ===');
    const msgs = await Message.find({}).sort({ timestamp: -1 }).limit(10).lean();
    for (const m of msgs.reverse()) {
      console.log(`[${m.timestamp?.toISOString()}] [${m.direction}] [${m.type}] text: "${m.content?.text || ''}" | sentBy: ${m.sentBy}`);
    }

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    process.exit(0);
  }
}

main();
