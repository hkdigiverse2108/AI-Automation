const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const BotFlow = require('../models/BotFlow');

async function run() {
  try {
    await connectDB();
    const user = await User.findOne({ email: 'princegajera0506@gmail.com' });
    if (!user) {
      console.log('Target user princegajera0506@gmail.com not found!');
      await disconnectDB();
      return;
    }
    console.log(`User found. ID: ${user._id}`);

    // Find the seeded flow
    const flow = await BotFlow.findOne({
      userId: user._id,
      name: "🏠 House Builder / Construction Company Workflow"
    });

    if (!flow) {
      console.log('Flow "🏠 House Builder / Construction Company Workflow" not found in user database!');
      await disconnectDB();
      return;
    }

    console.log(`Flow found: ${flow._id}`);

    // Find the node and fix it
    const visitTimeNode = flow.nodes.find(n => n.id === 'node_hb_new_house_visit_time');
    if (visitTimeNode) {
      console.log('Original visit time node section title:', visitTimeNode.data?.message?.sections?.[0]?.title);
      
      // Update section title to comply with limit
      if (visitTimeNode.data?.message?.sections?.[0]) {
        visitTimeNode.data.message.sections[0].title = "Visit Time / મુલાકાત";
        flow.markModified('nodes');
        await flow.save();
        console.log('Successfully updated the database entry section title!');
      } else {
        console.log('Sections not found on visit time node data!');
      }
    } else {
      console.log('Node node_hb_new_house_visit_time not found in flow!');
    }

    await disconnectDB();
  } catch (err) {
    console.error('Error fixing flow:', err.message);
  }
}

run();
