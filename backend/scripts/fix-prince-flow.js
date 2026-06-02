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

    // Update the welcome node (node_welcome) to include buttons
    const nodeWelcome = flow.nodes.find(node => node.id === 'node_welcome');
    if (nodeWelcome) {
      console.log('Original node_welcome:', JSON.stringify(nodeWelcome, null, 2));

      nodeWelcome.data.message = {
        type: 'buttons',
        text: "Hello 👋\n\nWelcome to *Chab Chabba Chab Water Park* 🌊🎢\n\nThank you for contacting us.\n\nPlease select your preferred language.\n\nનમસ્તે 👋\n\nછબ છબ્બા છબ વોટર પાર્કમાં આપનું સ્વાગત છે.\n\nકૃપા કરીને તમારી ભાષા પસંદ કરો.",
        buttons: [
          { id: 'lang_en', title: 'English' },
          { id: 'lang_gu', title: 'ગુજરાતી' }
        ]
      };

      flow.markModified('nodes');
      await flow.save();
      console.log('Successfully updated node_welcome with buttons!');
    } else {
      console.log('node_welcome not found in the flow nodes!');
    }

    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
