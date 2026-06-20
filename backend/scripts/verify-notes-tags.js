const { connectDB, disconnectDB } = require('../config/db');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Tag = require('../models/Tag');
const ContactTag = require('../models/ContactTag');
const ContactNote = require('../models/ContactNote');
const { generateOEK, encryptOEK, decryptOEK } = require('../services/oekService');

async function testSuite() {
  try {
    await connectDB();
    console.log('--- Connected to Database for Notes & Tags Verification ---');

    // 1. Fetch or create a mock Org and User
    let org = await Organization.findOne({ name: 'NotesTags Verification Org' });
    if (!org) {
      const rawOek = generateOEK();
      const encryptedOek = encryptOEK(rawOek);
      org = await Organization.create({
        name: 'NotesTags Verification Org',
        contactEmail: 'verifynt@test.com',
        status: 'active',
        subscriptionStatus: 'active',
        encryptionConfig: {
          enabled: true,
          oekEncrypted: encryptedOek,
        }
      });
    }

    let user = await User.findOne({ email: 'user@verifynt.com' });
    if (!user) {
      user = await User.create({
        name: 'NT Test User',
        email: 'user@verifynt.com',
        passwordHash: 'dummyhash123',
        role: 'admin',
        organizationId: org._id,
      });
    }

    let contact = await Contact.findOne({ name: 'Verification Contact', userId: user._id });
    if (!contact) {
      contact = await Contact.create({
        name: 'Verification Contact',
        phone: '1234567890',
        userId: user._id,
        organizationId: org._id,
        tags: []
      });
    }

    console.log(`Resolved Organization ID: ${org._id}`);
    console.log(`Resolved User ID: ${user._id}`);
    console.log(`Resolved Contact ID: ${contact._id}`);

    // Clean up older verification data
    await Tag.deleteMany({ organizationId: org._id });
    await ContactTag.deleteMany({ organizationId: org._id });
    await ContactNote.deleteMany({ organizationId: org._id });

    // --- TEST 1: TAG LIBRARY CRUD & DUPLICATE PREVENTION ---
    console.log('\n--- Test 1: Tag Library CRUD & Duplicate Prevention ---');
    
    // Create Tag
    const tagVIP = await Tag.create({
      organizationId: org._id,
      userId: user._id,
      name: 'VIP Lead',
      color: '#e11d48',
      createdBy: user._id
    });
    console.log(`✓ Tag Created: ${tagVIP.name} (${tagVIP.color})`);

    // Verify Duplicate Prevention via unique compound index or model logic
    try {
      await Tag.create({
        organizationId: org._id,
        userId: user._id,
        name: 'VIP Lead',
        color: '#2563eb',
        createdBy: user._id
      });
      console.log('✗ Fail: Duplicate tag allowed in database!');
    } catch (err) {
      console.log('✓ Success: Duplicate tag creation blocked by database index.');
    }

    // Update Tag
    tagVIP.color = '#f43f5e';
    await tagVIP.save();
    console.log(`✓ Tag Updated: ${tagVIP.name} new color is ${tagVIP.color}`);

    // --- TEST 2: CONTACT TAG ASSOCIATION & LEGACY ARRAY SYNCHRONIZATION ---
    console.log('\n--- Test 2: Contact Tag Association & Legacy Sync ---');

    // Create a helper mapping function/trigger
    // Let's add contact tag
    const contactTag = await ContactTag.create({
      organizationId: org._id,
      contactId: contact._id,
      tagId: tagVIP._id
    });
    console.log('✓ ContactTag mapped record created');

    // Re-sync contact tags list in Contact record
    const tagsMapped = await ContactTag.find({ contactId: contact._id }).populate('tagId');
    const tagNames = tagsMapped.map(ct => ct.tagId.name);
    contact.tags = tagNames;
    await contact.save();
    console.log(`✓ Synchronized contact.tags: ${JSON.stringify(contact.tags)} (Expected: ["VIP Lead"])`);

    // --- TEST 3: NOTE CREATION & OEK TRANSPARENT ENCRYPTION/DECRYPTION ---
    console.log('\n--- Test 3: Note Creation & OEK Transparent Encryption/Decryption ---');

    // Create Note
    const noteText = 'This is a super secret client quotation note for website development.';
    const newNote = await ContactNote.create({
      organizationId: org._id,
      contactId: contact._id,
      note: noteText,
      createdBy: user._id,
      isPinned: false
    });
    console.log(`✓ Note Saved: ${newNote._id}`);

    // Retrieve directly from Mongoose using fine-grained raw query to bypass decryption hooks
    const rawNote = await ContactNote.collection.findOne({ _id: newNote._id });
    console.log(`Raw note content in DB: "${rawNote.note}"`);
    if (rawNote.note !== noteText && rawNote.isEncrypted) {
      console.log('✓ Success: Note is encrypted at rest in the MongoDB collection!');
    } else {
      console.log('✗ Fail: Note is stored in plain text at rest!');
    }

    // Retrieve using mongoose finder (triggers post-find decryption hooks)
    const fetchedNote = await ContactNote.findById(newNote._id).populate('createdBy', 'name');
    console.log(`Decrypted note content: "${fetchedNote.note}"`);
    if (fetchedNote.note === noteText) {
      console.log('✓ Success: Transparent decryption hook decrypted note successfully!');
    } else {
      console.log('✗ Fail: Decrypted note content does not match original!');
    }

    // --- TEST 4: PINNING LOGIC & CHRONOLOGICAL/PINNED ORDERING ---
    console.log('\n--- Test 4: Pinning Logic & Ordering ---');

    // Create another note (unpinned)
    const note2 = await ContactNote.create({
      organizationId: org._id,
      contactId: contact._id,
      note: 'Follow-up next week.',
      createdBy: user._id,
      isPinned: false
    });

    // Create a third note (pinned)
    const note3 = await ContactNote.create({
      organizationId: org._id,
      contactId: contact._id,
      note: 'VIP customer. Handle with priority.',
      createdBy: user._id,
      isPinned: true
    });

    // Fetch notes list sorted by { isPinned: -1, createdAt: -1 }
    const sortedNotes = await ContactNote.find({ contactId: contact._id })
      .sort({ isPinned: -1, createdAt: -1 });

    console.log('Notes in retrieval order:');
    sortedNotes.forEach((n, idx) => {
      console.log(`  [${idx + 1}] Pinned: ${n.isPinned} - Created: ${n.createdAt} - Content: "${n.note}"`);
    });

    if (sortedNotes[0].isPinned && sortedNotes[0].note === 'VIP customer. Handle with priority.') {
      console.log('✓ Success: Pinned notes float to the top of the timeline feed!');
    } else {
      console.log('✗ Fail: Pinned note is not at the top of the feed!');
    }

    console.log('\n--- Verification Test Suite Finished Successfully ---');
  } catch (error) {
    console.error('Test Suite Failed with error:', error);
  } finally {
    await disconnectDB();
  }
}

testSuite();
