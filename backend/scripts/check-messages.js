const { connectDB, disconnectDB } = require('../config/db');
const Message = require('../models/Message');

async function run() {
  try {
    await connectDB();
    console.log('Querying outbound messages with userId...');
    const messages = await Message.find({ direction: 'outbound' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    messages.forEach(msg => {
      console.log({
        id: msg._id,
        status: msg.status,
        metaMessageId: msg.metaMessageId,
        userId: msg.userId,
        text: msg.content?.text ? msg.content.text.substring(0, 30) : '[Media/No Text]'
      });
    });
    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
