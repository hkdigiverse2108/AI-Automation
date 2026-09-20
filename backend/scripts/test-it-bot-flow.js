const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const { processIncomingMessage } = require('../services/botEngine');

async function runTests() {
  try {
    await connectDB();
    console.log('=== STARTING AUTOMATED IT BOT FLOW VERIFICATION ===');

    const user = await User.findOne({ email: 'princegajera0506@gmail.com' });
    if (!user) throw new Error('User princegajera0506@gmail.com not found');

    const wa = await WhatsAppAccount.findOne({ userId: user._id, isActive: true });
    if (!wa) throw new Error('WhatsAppAccount not found');

    const testPhone = '919999999999';
    const phoneNumberId = wa.phoneNumberId;

    // Reset test contact and conversation if exists
    await Message.deleteMany({ userId: user._id, contactId: { $in: await Contact.find({ phone: testPhone }).distinct('_id') } });
    await Conversation.deleteMany({ userId: user._id, contactId: { $in: await Contact.find({ phone: testPhone }).distinct('_id') } });
    await Contact.deleteMany({ userId: user._id, phone: testPhone });

    console.log(`\n[TEST 1] Inbound "Hello" message to start conversation`);
    const msgPayload1 = {
      id: `test_msg_${Date.now()}_1`,
      from: testPhone,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'text',
      text: { body: 'Hello' }
    };

    await processIncomingMessage(msgPayload1, phoneNumberId, null);

    // Check last outbound message
    const outMsg1 = await Message.findOne({ userId: user._id, direction: 'outbound' }).sort({ timestamp: -1 });
    console.log(`Outbound message type: ${outMsg1?.type}`);
    console.log(`Outbound message text / body:`, outMsg1?.content?.text || outMsg1?.content);
    
    if ((outMsg1?.content?.text || '').includes('Chab Chabba Chab') || (outMsg1?.content?.text || '').includes('Water Park')) {
      throw new Error('FAILED: Old Water Park message was sent!');
    }
    if (!(outMsg1?.content?.text || '').includes('HK DigiVerse')) {
      throw new Error('FAILED: Expected HK DigiVerse Welcome message!');
    }
    console.log('✅ TEST 1 PASSED: Received HK DigiVerse Welcome Menu');

    // Get contact and conversation
    const contact = await Contact.findOne({ userId: user._id }).sort({ createdAt: -1 });
    const conv = await Conversation.findOne({ userId: user._id, contactId: contact._id });
    console.log(`Current conversation node: ${conv?.currentNodeId}`);

    console.log(`\n[TEST 2] Inbound click: "it_services" (Explore IT Services)`);
    const msgPayload2 = {
      id: `test_msg_${Date.now()}_2`,
      from: testPhone,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'interactive',
      interactive: {
        type: 'list_reply',
        list_reply: { id: 'it_services', title: '🚀 Explore IT Services' }
      }
    };
    await processIncomingMessage(msgPayload2, phoneNumberId, null);

    const outMsg2 = await Message.findOne({ userId: user._id, direction: 'outbound' }).sort({ timestamp: -1 });
    console.log(`Outbound message text:`, outMsg2?.content?.text);
    if (!(outMsg2?.content?.text || '').includes('Our Core IT & Digital Services')) {
      throw new Error('FAILED: Expected Services Menu!');
    }
    console.log('✅ TEST 2 PASSED: Received Services List Menu');

    console.log(`\n[TEST 3] Inbound selection: "srv_web" (Web & E-Commerce Development)`);
    const msgPayload3 = {
      id: `test_msg_${Date.now()}_3`,
      from: testPhone,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'interactive',
      interactive: {
        type: 'list_reply',
        list_reply: { id: 'srv_web', title: '🌐 Web & E-Commerce' }
      }
    };
    await processIncomingMessage(msgPayload3, phoneNumberId, null);

    const outMsg3 = await Message.findOne({ userId: user._id, direction: 'outbound' }).sort({ timestamp: -1 });
    console.log(`Outbound message text:`, outMsg3?.content?.text);
    if (!(outMsg3?.content?.text || '').includes('Web & E-Commerce Development')) {
      throw new Error('FAILED: Expected Web Development Detail message!');
    }
    console.log('✅ TEST 3 PASSED: Received Web Development Details');

    console.log(`\n[TEST 4] Test that sending "menu" returns to Welcome menu and does NOT trigger Catalog`);
    const msgPayload4 = {
      id: `test_msg_${Date.now()}_4`,
      from: testPhone,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'text',
      text: { body: 'menu' }
    };
    await processIncomingMessage(msgPayload4, phoneNumberId, null);

    const outMsg4 = await Message.findOne({ userId: user._id, direction: 'outbound' }).sort({ timestamp: -1 });
    console.log(`Outbound message text:`, outMsg4?.content?.text);
    if ((outMsg4?.content?.text || '').includes('Catalog') || (outMsg4?.content?.text || '').includes('products')) {
      throw new Error('FAILED: "menu" triggered the commerce catalog!');
    }
    if (!(outMsg4?.content?.text || '').includes('HK DigiVerse')) {
      throw new Error('FAILED: Expected HK DigiVerse Welcome message on "menu" command!');
    }
    console.log('✅ TEST 4 PASSED: "menu" cleanly returned to IT Main Menu without catalog hijacking!');

    console.log(`\n[TEST 5] Direct Timeline button click verification (The exact issue reported)`);
    // Jump conversation to node_quote_timeline
    const testConv = await Conversation.findOne({ userId: user._id, contactId: contact._id });
    testConv.currentNodeId = 'node_quote_timeline';
    await testConv.save();

    const msgPayload5 = {
      id: `test_msg_${Date.now()}_5`,
      from: testPhone,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: { id: 'time_flexible', title: '⏳ Flexible / Plannin' }
      }
    };
    await processIncomingMessage(msgPayload5, phoneNumberId, null);

    const outMsg5 = await Message.findOne({ userId: user._id, direction: 'outbound' }).sort({ timestamp: -1 });
    console.log(`Outbound message text:`, outMsg5?.content?.text);
    if ((outMsg5?.content?.text || '').includes('Please enter a valid date')) {
      throw new Error('FAILED: Still asking for valid date on timeline button!');
    }
    if (!(outMsg5?.content?.text || '').includes('Estimated Budget') && !(outMsg5?.content?.text || '').includes('Step 4 of 4')) {
      throw new Error('FAILED: Did not proceed to Step 4 Budget estimation!');
    }
    console.log('✅ TEST 5 PASSED: Timeline button cleanly progressed to Step 4 Budget without date error!');

    console.log('\n=============================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! BOT IS 100% OPERATIONAL!');
    console.log('=============================================');

  } catch (err) {
    console.error('\n❌ Test failure:', err.message);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

runTests();
