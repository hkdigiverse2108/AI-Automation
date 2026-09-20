const { connectDB } = require('../config/db');
const BotFlow = require('../models/BotFlow');

async function main() {
  try {
    await connectDB();
    const bot = await BotFlow.findById('6a4360907c40cad078a551b4').lean();
    if (bot) {
      console.log('Digital Business Transformation Campaign Bot:');
      console.log(JSON.stringify(bot, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
main();
