const { connectDB } = require('../config/db');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const User = require('../models/User');

async function main() {
  try {
    await connectDB();
    const lastMsg = await Message.findOne({ 'content.text': /Chab Chabba Chab/ }).sort({ timestamp: -1 });
    if (lastMsg) {
      console.log('Last message found:', lastMsg._id, 'userId:', lastMsg.userId);
      const conv = await Conversation.findById(lastMsg.conversationId);
      const contact = await Contact.findById(lastMsg.contactId);
      const user = await User.findById(lastMsg.userId);
      const wa = await WhatsAppAccount.findOne({ userId: lastMsg.userId });
      console.log('User:', user?.email, 'Org:', user?.organizationId);
      console.log('WhatsApp Phone Number:', wa?.phoneNumber || wa?.phone, 'Phone Number ID:', wa?.phoneNumberId);
      console.log('Contact:', contact?.phone, contact?.name);
      console.log('Conversation currentFlowId:', conv?.currentFlowId, 'currentNodeId:', conv?.currentNodeId);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
main();
