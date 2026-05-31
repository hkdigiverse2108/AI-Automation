const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Lead = require('../models/Lead');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const waterParkService = require('../services/waterParkService');

async function run() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Cleaning up old test accounts...');
    await User.deleteMany({ email: 'princegajera0506@gmail.com' });
    await Organization.deleteMany({ name: 'Chab Chabba Chab Test Park' });
    await WhatsAppAccount.deleteMany({ phoneNumberId: '1234567890' });
    await Lead.deleteMany({ serviceRequired: /Water Park/ });

    console.log('Creating Chab Chabba Chab Water Park organization and user...');
    const org = await Organization.create({
      name: 'Chab Chabba Chab Test Park',
      contactEmail: 'princegajera0506@gmail.com',
      plan: 'pro',
      status: 'active'
    });

    const user = await User.create({
      name: 'Prince Gajera',
      email: 'princegajera0506@gmail.com',
      passwordHash: 'prince-dummy-hash',
      role: 'owner',
      organizationId: org._id
    });

    const waAccount = await WhatsAppAccount.create({
      userId: user._id,
      phoneNumber: '919876543210',
      phoneNumberId: '1234567890',
      wabaId: 'waba_chab_chab',
      accessToken: 'mock_demo_token',
      isActive: true
    });

    // Create a mock Contact & Conversation representing customer
    const customerPhone = '919876543210';
    let contact = await Contact.create({
      userId: user._id,
      phone: customerPhone,
      name: 'Customer Test',
      source: 'direct'
    });

    let conversation = await Conversation.create({
      userId: user._id,
      contactId: contact._id,
      status: 'bot'
    });

    console.log('--- TEST STEP 1: Sending Hello to initialize Welcome Flow ---');
    let incomingMsg = await Message.create({
      userId: user._id,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'inbound',
      type: 'text',
      content: { text: 'Hello' },
      status: 'delivered',
      sentBy: 'system'
    });

    await waterParkService.processIncomingMessage(incomingMsg, waAccount, 'mock', null);

    // Assert state is set to welcome
    contact = await Contact.findById(contact._id);
    console.log('  Contact wp_state:', contact.customFields?.get('wp_state'));
    if (contact.customFields?.get('wp_state') !== 'welcome') {
      throw new Error('Initial state should be welcome');
    }

    console.log('--- TEST STEP 2: Selecting English ---');
    incomingMsg = await Message.create({
      userId: user._id,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'inbound',
      type: 'text',
      content: { text: 'English' },
      status: 'delivered',
      sentBy: 'system'
    });
    await waterParkService.processIncomingMessage(incomingMsg, waAccount, 'mock', null);

    contact = await Contact.findById(contact._id);
    console.log('  Contact wp_lang:', contact.customFields?.get('wp_lang'));
    console.log('  Contact wp_state:', contact.customFields?.get('wp_state'));
    if (contact.customFields?.get('wp_lang') !== 'en') {
      throw new Error('Language selection failed');
    }
    if (contact.customFields?.get('wp_state') !== 'main_menu') {
      throw new Error('State transition to main_menu failed');
    }

    console.log('--- TEST STEP 3: Selecting Ticket Prices ---');
    incomingMsg = await Message.create({
      userId: user._id,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'inbound',
      type: 'text',
      content: { text: 'Ticket Prices' },
      status: 'delivered',
      sentBy: 'system'
    });
    await waterParkService.processIncomingMessage(incomingMsg, waAccount, 'mock', null);
    
    // Assert viewed products updated
    contact = await Contact.findById(contact._id);
    console.log('  Viewed products:', contact.customFields?.get('wp_viewed_products'));
    if (!contact.customFields?.get('wp_viewed_products')?.includes('ticket_prices')) {
      throw new Error('Failed to record viewed product: ticket_prices');
    }

    console.log('--- TEST STEP 4: Triggering Ticket Booking Wizard ---');
    incomingMsg = await Message.create({
      userId: user._id,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'inbound',
      type: 'text',
      content: { text: 'Book Tickets' },
      status: 'delivered',
      sentBy: 'system'
    });
    await waterParkService.processIncomingMessage(incomingMsg, waAccount, 'mock', null);

    contact = await Contact.findById(contact._id);
    console.log('  State after Trigger Book:', contact.customFields?.get('wp_state'));
    if (contact.customFields?.get('wp_state') !== 'booking_name') {
      throw new Error('Failed to transition to booking_name');
    }

    console.log('--- TEST STEP 5: Booking Details Flow (Name -> Date -> Adults -> Kids -> Room -> Requests) ---');
    const bookingSteps = [
      { text: 'John Doe', nextState: 'booking_date' },
      { text: '12-08-2026', nextState: 'booking_adults' },
      { text: '4', nextState: 'booking_children' },
      { text: '2', nextState: 'booking_room' },
      { text: 'Marine Villa', nextState: 'booking_requests' },
      { text: 'Extra pillows', nextState: 'main_menu' }
    ];

    for (const step of bookingSteps) {
      incomingMsg = await Message.create({
        userId: user._id,
        conversationId: conversation._id,
        contactId: contact._id,
        direction: 'inbound',
        type: 'text',
        content: { text: step.text },
        status: 'delivered',
        sentBy: 'system'
      });
      await waterParkService.processIncomingMessage(incomingMsg, waAccount, 'mock', null);
      contact = await Contact.findById(contact._id);
      console.log(`  Sent: "${step.text}", State is now: ${contact.customFields?.get('wp_state')}`);
      if (contact.customFields?.get('wp_state') !== step.nextState) {
        throw new Error(`State machine validation failed at step: ${step.text}`);
      }
    }

    console.log('--- TEST STEP 6: Asserting Lead is qualified and saved in MongoDB ---');
    const savedLead = await Lead.findOne({ userId: user._id, contactId: contact._id });
    if (!savedLead) {
      throw new Error('No lead was qualified after booking completion');
    }
    console.log('  Qualified Lead Summary:');
    console.log('    Name:', savedLead.name);
    console.log('    Service:', savedLead.serviceRequired);
    console.log('    Description:', savedLead.projectDescription);
    console.log('    Notes:', savedLead.notes);

    if (savedLead.name !== 'John Doe') throw new Error('Lead name mismatch');
    if (!savedLead.projectDescription.includes('Adults: 4')) throw new Error('Lead details missing');

    console.log('--- TEST STEP 7: Talk to Executive (Human Takeover) ---');
    incomingMsg = await Message.create({
      userId: user._id,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'inbound',
      type: 'text',
      content: { text: 'Talk To Executive' },
      status: 'delivered',
      sentBy: 'system'
    });
    await waterParkService.processIncomingMessage(incomingMsg, waAccount, 'mock', null);

    conversation = await Conversation.findById(conversation._id);
    console.log('  Conversation Handoff status:', conversation.status);
    if (conversation.status !== 'human') {
      throw new Error('Human Handoff failed');
    }

    console.log('Deleting test records...');
    await User.deleteOne({ _id: user._id });
    await Organization.deleteOne({ _id: org._id });
    await Contact.deleteOne({ _id: contact._id });
    await Message.deleteMany({ conversationId: conversation._id });
    await Conversation.deleteOne({ _id: conversation._id });
    await Lead.deleteOne({ _id: savedLead._id });
    await WhatsAppAccount.deleteOne({ _id: waAccount._id });

    console.log('\n✅ ALL CHAB CHABBA CHAB WATER PARK WORKFLOW TESTS PASSED SUCCESSFULLY!');
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.stack);
    try { await disconnectDB(); } catch (_) {}
    process.exit(1);
  }
}

run();
