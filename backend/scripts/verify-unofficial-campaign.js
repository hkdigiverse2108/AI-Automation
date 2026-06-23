const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const Message = require('../models/Message');
const queueService = require('../services/queueService');

async function run() {
  try {
    await connectDB();
    const user = await User.findOne({ email: 'princegajera0506@gmail.com' });
    if (!user) {
      console.log('❌ User not found!');
      await disconnectDB();
      return;
    }
    console.log(`User found: ${user.email} (${user._id})`);

    const waAccount = await WhatsAppAccount.findOne({ userId: user._id, isActive: true });
    if (!waAccount) {
      console.log('❌ No active WhatsApp account found!');
      await disconnectDB();
      return;
    }

    // 1. Create 10 dummy contacts for testing the rate limit
    console.log('Creating 10 dummy contacts...');
    const contactIds = [];
    // Clean up previous dummy contacts
    await Contact.deleteMany({ phone: { $regex: '^910000000' }, userId: user._id });
    
    for (let i = 0; i < 10; i++) {
      const contact = await Contact.create({
        userId: user._id,
        phone: `910000000${i}`,
        name: `Dummy Rate Test ${i}`,
        isDeleted: false,
        optedOut: false
      });
      contactIds.push(contact._id);
    }

    // 2. Create an unofficial campaign
    console.log('Creating Unofficial Campaign...');
    const campaign = await Campaign.create({
      userId: user._id,
      name: 'Verify Unofficial Campaign Rate',
      templateName: 'hello_world',
      templateId: 'tpl_hello_world',
      audience: {
        type: 'upload',
        contactIds: contactIds
      },
      variables: [],
      isUnofficial: true,
      status: 'draft'
    });

    console.log(`Campaign created with ID: ${campaign._id}. isUnofficial = ${campaign.isUnofficial}`);

    // Init queues
    const mockIo = {
      to: () => ({
        emit: () => {}
      })
    };
    queueService.initQueues(mockIo);

    const startTime = Date.now();
    const result = await queueService.startCampaign(campaign._id, user._id);
    console.log('Campaign launch results:', result);

    console.log('Waiting 10 seconds for campaign to finish sending all 10 messages...');
    await new Promise(r => setTimeout(r, 10000));

    // 3. Print out timestamps of sent messages
    const sentMessages = await Message.find({ campaignId: campaign._id }).sort({ createdAt: 1 }).lean();
    console.log(`\nSent messages count: ${sentMessages.length}`);
    
    if (sentMessages.length > 0) {
      console.log('\nTimestamps:');
      sentMessages.forEach((msg, idx) => {
        console.log(`- Message ${idx + 1}: ${msg.createdAt.toISOString()}`);
      });

      const firstTime = new Date(sentMessages[0].createdAt).getTime();
      const lastTime = new Date(sentMessages[sentMessages.length - 1].createdAt).getTime();
      const durationSec = (lastTime - firstTime) / 1000;
      console.log(`\nFirst message sent at: ${sentMessages[0].createdAt.toISOString()}`);
      console.log(`Last message sent at: ${sentMessages[sentMessages.length - 1].createdAt.toISOString()}`);
      console.log(`Total duration for 10 messages: ${durationSec.toFixed(2)} seconds`);
      console.log(`Average sending rate: ${(sentMessages.length / durationSec).toFixed(2)} messages/second`);
      
      if (durationSec >= 1.5) {
        console.log('\n✅ SUCCESS: Rate limit of 5 messages/second is successfully enforced!');
      } else {
        console.log('\n❌ FAILURE: Sending rate is too fast (no rate limit enforced).');
      }
    } else {
      console.log('\n❌ FAILURE: No messages were sent.');
    }

    // Clean up
    console.log('\nCleaning up verification resources...');
    await Contact.deleteMany({ _id: { $in: contactIds } });
    await Campaign.deleteOne({ _id: campaign._id });
    await Message.deleteMany({ campaignId: campaign._id });

    await disconnectDB();
  } catch (err) {
    console.error('Error during verification:', err);
    try { await disconnectDB(); } catch (_) {}
  }
}

run();
