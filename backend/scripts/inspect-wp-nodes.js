const { connectDB } = require('../config/db');
const BotFlow = require('../models/BotFlow');

async function main() {
  try {
    await connectDB();
    const wpFlow = await BotFlow.findById('6a1d01ab7759f8a279040f7e').lean();
    if (wpFlow) {
      console.log('Waterpark Flow Nodes:');
      wpFlow.nodes.forEach(n => {
        console.log(`Node [${n.id}] (${n.type}): text="${n.data?.text?.slice(0, 40) || ''}" options=${JSON.stringify(n.data?.options || n.data?.buttons || [])}`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
main();
