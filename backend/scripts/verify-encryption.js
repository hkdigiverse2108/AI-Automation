const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getOekForUser, generateHMAC } = require('../services/oekService');

async function run() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Cleaning up old test users & organizations...');
    await User.deleteMany({ email: 'test-crypto-owner@example.com' });
    await Organization.deleteMany({ name: 'Crypto Test Org' });

    console.log('Creating organization and user...');
    const org = await Organization.create({
      name: 'Crypto Test Org',
      contactEmail: 'test-crypto-owner@example.com',
      plan: 'pro',
      status: 'active'
    });

    const user = await User.create({
      name: 'Crypto Owner',
      email: 'test-crypto-owner@example.com',
      passwordHash: 'dummy-hash',
      role: 'owner',
      organizationId: org._id
    });

    console.log('Asserting that encryption is initially disabled...');
    const oekBefore = await getOekForUser(user._id);
    if (oekBefore) throw new Error('OEK should not exist yet');

    console.log('Enabling Zero-Knowledge Encryption on Organization...');
    const { generateOEK, encryptOEK } = require('../services/oekService');
    const oek = generateOEK();
    org.encryptionConfig = {
      enabled: true,
      oekEncrypted: encryptOEK(oek),
      lastRotatedAt: new Date()
    };
    await org.save();

    console.log('OEK registered! Decrypting and checking in-memory cache...');
    const decryptedOek = await getOekForUser(user._id);
    if (decryptedOek !== oek) throw new Error('OEK decryption mismatch');

    console.log('Creating a test Contact...');
    const phone = '+919988776655';
    const name = 'Alice cryptography';
    const email = 'alice@zkcrypto.com';
    const notes = 'Super confidential trade secret comment';

    const contact = await Contact.create({
      userId: user._id,
      phone,
      name,
      email,
      notes
    });

    console.log('Bypassing Mongoose to inspect raw MongoDB values...');
    const rawContact = await mongoose.connection.collection('contacts').findOne({ _id: contact._id });
    
    console.log('Raw MongoDB Contact values:');
    console.log('  phone:', rawContact.phone);
    console.log('  name:', rawContact.name);
    console.log('  email:', rawContact.email);
    console.log('  notes:', rawContact.notes);
    console.log('  phoneHash:', rawContact.phoneHash);
    console.log('  isEncrypted:', rawContact.isEncrypted);

    if (rawContact.phone === phone) throw new Error('Phone should be encrypted in raw DB');
    if (rawContact.name === name) throw new Error('Name should be encrypted in raw DB');
    if (rawContact.notes === notes) throw new Error('Notes should be encrypted in raw DB');
    if (!rawContact.isEncrypted) throw new Error('isEncrypted should be true');

    const expectedPhoneHash = generateHMAC(phone.replace(/\D/g, ''), oek);
    if (rawContact.phoneHash !== expectedPhoneHash) throw new Error('phoneHash mismatch');

    console.log('Asserting that Mongoose queries automatically decrypt the Contact...');
    const fetchedContact = await Contact.findById(contact._id);
    console.log('Fetched Contact:');
    console.log('  phone:', fetchedContact.phone);
    console.log('  name:', fetchedContact.name);
    console.log('  email:', fetchedContact.email);
    console.log('  notes:', fetchedContact.notes);

    const normalizedPhone = phone.replace(/\D/g, '');
    if (fetchedContact.phone !== normalizedPhone) throw new Error('Phone decryption failed');
    if (fetchedContact.name !== name) throw new Error('Name decryption failed');
    if (fetchedContact.email !== email) throw new Error('Email decryption failed');
    if (fetchedContact.notes !== notes) throw new Error('Notes decryption failed');

    console.log('Creating a test Message...');
    const conversation = await Conversation.create({
      userId: user._id,
      contactId: contact._id,
      status: 'human'
    });

    const msgText = 'Meet me at the secret server bank at midnight.';
    const message = await Message.create({
      userId: user._id,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'outbound',
      type: 'text',
      content: { text: msgText },
      sentBy: 'human'
    });

    const rawMsg = await mongoose.connection.collection('messages').findOne({ _id: message._id });
    console.log('Raw MongoDB Message values:');
    console.log('  content.text:', rawMsg.content.text);
    console.log('  isEncrypted:', rawMsg.isEncrypted);

    if (rawMsg.content.text === msgText) throw new Error('Message text should be encrypted in raw DB');
    if (!rawMsg.isEncrypted) throw new Error('isEncrypted should be true');

    const fetchedMsg = await Message.findById(message._id);
    console.log('Fetched Message text:', fetchedMsg.content.text);
    if (fetchedMsg.content.text !== msgText) throw new Error('Message text decryption failed');

    console.log('Rotating the Organization Encryption Key (OEK)...');
    const oldOekEncrypted = org.encryptionConfig.oekEncrypted;
    const newOekValue = generateOEK();
    
    if (!org.encryptionConfig.keyRotationHistory) {
      org.encryptionConfig.keyRotationHistory = [];
    }
    org.encryptionConfig.keyRotationHistory.push({
      rotatedAt: new Date(),
      oldOekEncrypted
    });
    org.encryptionConfig.oekEncrypted = encryptOEK(newOekValue);
    org.encryptionConfig.lastRotatedAt = new Date();
    await org.save();

    const { clearOekCache } = require('../services/oekService');
    clearOekCache(org._id);

    console.log('Asserting new OEK is resolved...');
    const currentOek = await getOekForUser(user._id);
    if (currentOek !== newOekValue) throw new Error('New OEK rotation resolve failed');

    console.log('Deleting test records...');
    await User.deleteOne({ _id: user._id });
    await Organization.deleteOne({ _id: org._id });
    await Contact.deleteOne({ _id: contact._id });
    await Message.deleteOne({ _id: message._id });
    await Conversation.deleteOne({ _id: conversation._id });

    console.log('\n✅ ALL CRYPTOGRAPHIC ENVELOPE ENCRYPTION TESTS PASSED SUCCESSFULLY!');
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.stack);
    try { await disconnectDB(); } catch (_) {}
    process.exit(1);
  }
}

run();
