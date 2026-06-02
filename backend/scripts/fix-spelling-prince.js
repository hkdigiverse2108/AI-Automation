const { connectDB, disconnectDB } = require('../config/db');
const BotFlow = require('../models/BotFlow');

async function run() {
  try {
    await connectDB();
    const flowId = '6a1d01ab7759f8a279040f7e';
    const flow = await BotFlow.findById(flowId);
    if (!flow) {
      console.log(`Flow with ID ${flowId} not found!`);
      await disconnectDB();
      return;
    }

    console.log('Flow found:', flow.name);

    let updatedCount = 0;
    flow.nodes.forEach(node => {
      if (node.data && node.data.message) {
        const msg = node.data.message;

        // Check msg.text
        if (msg.text && msg.text.includes('ચાબ છબ્બા છબ')) {
          console.log(`Updating node ${node.id} msg.text:`, msg.text);
          msg.text = msg.text.replace(/ચાબ છબ્બા છબ/g, 'છબ છબ્બા છબ');
          updatedCount++;
        }

        // Check msg.body (for list messages)
        if (msg.body && msg.body.includes('ચાબ છબ્બા છબ')) {
          console.log(`Updating node ${node.id} msg.body:`, msg.body);
          msg.body = msg.body.replace(/ચાબ છબ્બા છબ/g, 'છબ છબ્બા છબ');
          updatedCount++;
        }

        // Check msg.caption (for images)
        if (msg.caption && msg.caption.includes('ચાબ છબ્બા છબ')) {
          console.log(`Updating node ${node.id} msg.caption:`, msg.caption);
          msg.caption = msg.caption.replace(/ચાબ છબ્બા છબ/g, 'છબ છબ્બા છબ');
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      flow.markModified('nodes');
      await flow.save();
      console.log(`Successfully fixed ${updatedCount} occurrences of spelling mismatches!`);
    } else {
      console.log('No spelling mismatches found.');
    }

    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
