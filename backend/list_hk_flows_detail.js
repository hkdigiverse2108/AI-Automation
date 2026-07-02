const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('./models/User');
const BotFlow = require('./models/BotFlow');

async function debug() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const hk = await User.findOne({ email: 'hk@gmail.com' });
  if (hk) {
    console.log('\n--- HK BOT FLOWS DETAIL ---');
    const flows = await BotFlow.find({ userId: hk._id });
    for (const f of flows) {
      console.log(`=================================================`);
      console.log(`Flow: Name="${f.name}" ID=${f._id} IsActive=${f.isActive}`);
      console.log(`Trigger: ${JSON.stringify(f.trigger)}`);
      console.log(`Entry Node ID: ${f.entryNodeId}`);
      console.log(`Nodes Count: ${f.nodes?.length}`);
      f.nodes.forEach(n => {
        console.log(`  - Node: ID="${n.id}" Type="${n.type}" Variable="${n.data?.variable || ''}"`);
        if (n.data?.message) {
          console.log(`    Message: ${JSON.stringify(n.data.message)}`);
        }
        if (n.edges && n.edges.length > 0) {
          console.log(`    Edges: ${JSON.stringify(n.edges)}`);
        }
      });
    }
  }

  await mongoose.disconnect();
}

debug();
