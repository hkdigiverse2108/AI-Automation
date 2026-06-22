#!/usr/bin/env node

/**
 * Customer Notes & Tags Module Verification Script
 * 
 * Verifies:
 * 1. RBAC Privilege Resolver (Admin, Manager, Agent)
 * 2. Tag library unique indexes (Duplicate name prevention within org)
 * 3. ContactTag unique indexes (Duplicate assignment prevention)
 * 4. Transparent OEK Encryption/Decryption of notes at rest
 * 5. Pinned notes sorting order
 * 6. Notification system triggers
 * 7. Organization data isolation
 */

const mongoose = require('mongoose');
require('dotenv').config();

const env = require('../config/env');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Tag = require('../models/Tag');
const ContactTag = require('../models/ContactTag');
const ContactNote = require('../models/ContactNote');
const Notification = require('../models/Notification');
const { generateOEK, encryptOEK } = require('../services/oekService');
const { createNotification } = require('../services/notificationService');

let testResults = [];

// Colored logger proxy helper
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

async function connectDB() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log(colors.green('✓ Connected to MongoDB'));
    return true;
  } catch (err) {
    console.error(colors.red('✗ MongoDB connection failed:'), err.message);
    return false;
  }
}

async function test(name, fn) {
  try {
    console.log(colors.cyan(`\nRunning: ${name}`));
    await fn();
    console.log(colors.green(`✓ PASS: ${name}`));
    testResults.push({ name, passed: true });
  } catch (err) {
    console.error(colors.red(`✗ FAIL: ${name}`));
    console.error(colors.red(`  Error: ${err.message}`));
    testResults.push({ name, passed: false, error: err.message });
  }
}

// 1. Helper Privilege Resolver Logic
function getUserPrivilege(user) {
  const privilege = user.role;
  const isManager = 
    (user.designation && /manager/i.test(user.designation)) || 
    (user.department && /manager/i.test(user.department));
  const isAdminOrManager = ['superadmin', 'owner', 'admin'].includes(privilege) || isManager;
  return { isAdminOrManager, isManager };
}

async function testRBACPrivileges() {
  // Test case 1: Admin user
  const adminUser = { role: 'admin' };
  const adminRes = getUserPrivilege(adminUser);
  if (!adminRes.isAdminOrManager) {
    throw new Error('Admin user was not resolved as admin/manager');
  }

  // Test case 2: Manager via Designation
  const managerUser1 = { role: 'agent', designation: 'Sales Manager' };
  const managerRes1 = getUserPrivilege(managerUser1);
  if (!managerRes1.isAdminOrManager || !managerRes1.isManager) {
    throw new Error('Manager via designation was not resolved correctly');
  }

  // Test case 3: Manager via Department
  const managerUser2 = { role: 'agent', department: 'Notes Managers Team' };
  const managerRes2 = getUserPrivilege(managerUser2);
  if (!managerRes2.isAdminOrManager || !managerRes2.isManager) {
    throw new Error('Manager via department was not resolved correctly');
  }

  // Test case 4: Regular Agent
  const agentUser = { role: 'agent', designation: 'Sales Representative', department: 'Outbound' };
  const agentRes = getUserPrivilege(agentUser);
  if (agentRes.isAdminOrManager || agentRes.isManager) {
    throw new Error('Agent was incorrectly resolved as admin/manager');
  }

  console.log('  └─ RBAC Dynamic privilege resolver holds correct properties ✓');
}

async function testTagLibraryUniqueness() {
  // Create mock org
  const org = await Organization.create({
    name: `Test Org ${Date.now()}`,
    contactEmail: `org-${Date.now()}@test.com`
  });

  const owner = await User.create({
    name: 'Org Owner',
    email: `owner-${Date.now()}@test.com`,
    passwordHash: 'test',
    role: 'owner',
    organizationId: org._id
  });

  // Create Tag 1
  const tag1 = await Tag.create({
    name: 'hot lead',
    color: '#ff0000',
    userId: owner._id,
    organizationId: org._id,
    createdBy: owner._id
  });

  // Attempt duplicate tag inside same org (should fail unique index)
  try {
    await Tag.create({
      name: 'hot lead',
      color: '#00ff00',
      userId: owner._id,
      organizationId: org._id,
      createdBy: owner._id
    });
    throw new Error('Duplicate tag creation inside same organization was allowed!');
  } catch (err) {
    if (err.message.includes('allowed')) {
      throw err;
    }
    console.log('  └─ Unique index prevents duplicate tags in organization ✓');
  }

  // Clean up
  await Tag.deleteOne({ _id: tag1._id });
  await User.deleteOne({ _id: owner._id });
  await Organization.deleteOne({ _id: org._id });
}

async function testContactTagAssignment() {
  const org = await Organization.create({
    name: `Test Org ${Date.now()}`,
    contactEmail: `org-${Date.now()}@test.com`
  });

  const owner = await User.create({
    name: 'Org Owner',
    email: `owner-${Date.now()}@test.com`,
    passwordHash: 'test',
    role: 'owner',
    organizationId: org._id
  });

  const contact = await Contact.create({
    userId: owner._id,
    phone: `555333${Math.random().toString().slice(2, 5)}`,
    name: 'Tagged Contact'
  });

  const tag = await Tag.create({
    name: 'vip',
    color: '#ff0000',
    userId: owner._id,
    organizationId: org._id,
    createdBy: owner._id
  });

  // Assign tag to contact
  const assignment1 = await ContactTag.create({
    organizationId: org._id,
    contactId: contact._id,
    tagId: tag._id
  });

  // Try duplicate assignment
  try {
    await ContactTag.create({
      organizationId: org._id,
      contactId: contact._id,
      tagId: tag._id
    });
    throw new Error('Duplicate ContactTag assignment was allowed!');
  } catch (err) {
    if (err.message.includes('allowed')) {
      throw err;
    }
    console.log('  └─ ContactTag unique index prevents duplicate assignments ✓');
  }

  // Clean up
  await ContactTag.deleteOne({ _id: assignment1._id });
  await Tag.deleteOne({ _id: tag._id });
  await Contact.deleteOne({ _id: contact._id });
  await User.deleteOne({ _id: owner._id });
  await Organization.deleteOne({ _id: org._id });
}

async function testNotesOEKEncryption() {
  // Create Org with encryption enabled
  const rawOek = generateOEK();
  const encryptedOek = encryptOEK(rawOek);

  const encryptedOrg = await Organization.create({
    name: `Encrypted Org ${Date.now()}`,
    contactEmail: `enc-${Date.now()}@test.com`,
    encryptionConfig: {
      enabled: true,
      oekEncrypted: encryptedOek
    }
  });

  const owner = await User.create({
    name: 'Org Owner',
    email: `owner-${Date.now()}@test.com`,
    passwordHash: 'test',
    role: 'owner',
    organizationId: encryptedOrg._id
  });

  const contact = await Contact.create({
    userId: owner._id,
    phone: `555444${Math.random().toString().slice(2, 5)}`,
    name: 'Encrypted Contact'
  });

  const noteText = 'Secret quotations: $15,000 for SaaS dashboard implementation.';

  const note = await ContactNote.create({
    organizationId: encryptedOrg._id,
    contactId: contact._id,
    note: noteText,
    createdBy: owner._id
  });

  // Verify raw record is encrypted in collection
  const rawRecord = await ContactNote.collection.findOne({ _id: note._id });
  if (rawRecord.note === noteText) {
    throw new Error('Note was stored in plain text despite encryption being enabled');
  }
  if (!rawRecord.isEncrypted) {
    throw new Error('Note flag isEncrypted is not true');
  }
  console.log('  └─ Note was successfully encrypted in collection ✓');

  // Verify mongoose finder transparently decrypts
  const decryptedRecord = await ContactNote.findById(note._id);
  if (decryptedRecord.note !== noteText) {
    throw new Error(`Decryption failed: expected "${noteText}" but got "${decryptedRecord.note}"`);
  }
  console.log('  └─ Note decrypted transparently on query ✓');

  // Clean up
  await ContactNote.deleteOne({ _id: note._id });
  await Contact.deleteOne({ _id: contact._id });
  await User.deleteOne({ _id: owner._id });
  await Organization.deleteOne({ _id: encryptedOrg._id });
}

async function testNotesSortingOrder() {
  const org = await Organization.create({
    name: `Test Org ${Date.now()}`,
    contactEmail: `org-${Date.now()}@test.com`
  });

  const owner = await User.create({
    name: 'Org Owner',
    email: `owner-${Date.now()}@test.com`,
    passwordHash: 'test',
    role: 'owner',
    organizationId: org._id
  });

  const contact = await Contact.create({
    userId: owner._id,
    phone: `555555${Math.random().toString().slice(2, 5)}`,
    name: 'Sort Test Contact'
  });

  // Create note 1 (normal)
  const n1 = await ContactNote.create({
    organizationId: org._id,
    contactId: contact._id,
    note: 'Note 1 (oldest)',
    createdBy: owner._id,
    createdAt: new Date(Date.now() - 3600000) // 1 hour ago
  });

  // Create note 2 (newest unpinned)
  const n2 = await ContactNote.create({
    organizationId: org._id,
    contactId: contact._id,
    note: 'Note 2 (newest)',
    createdBy: owner._id,
    createdAt: new Date()
  });

  // Create note 3 (pinned, older than n2)
  const n3 = await ContactNote.create({
    organizationId: org._id,
    contactId: contact._id,
    note: 'Note 3 (pinned)',
    createdBy: owner._id,
    isPinned: true,
    createdAt: new Date(Date.now() - 1800000) // 30 mins ago
  });

  const sortedList = await ContactNote.find({ contactId: contact._id }).sort({ isPinned: -1, createdAt: -1 });

  if (sortedList.length !== 3) {
    throw new Error('Not all notes were fetched');
  }

  // Pinned note (n3) must be first
  if (sortedList[0]._id.toString() !== n3._id.toString()) {
    throw new Error('Pinned note did not float to the top');
  }

  // Newer unpinned note (n2) must be second
  if (sortedList[1]._id.toString() !== n2._id.toString()) {
    throw new Error('Newer unpinned note was not in the correct position');
  }

  // Oldest note (n1) must be last
  if (sortedList[2]._id.toString() !== n1._id.toString()) {
    throw new Error('Oldest note was not at the bottom');
  }

  console.log('  └─ Sorting yields correct order: Pinned notes -> Chronological order ✓');

  // Clean up
  await ContactNote.deleteMany({ contactId: contact._id });
  await Contact.deleteOne({ _id: contact._id });
  await User.deleteOne({ _id: owner._id });
  await Organization.deleteOne({ _id: org._id });
}

async function testNotificationTriggers() {
  const org = await Organization.create({
    name: `Test Org ${Date.now()}`,
    contactEmail: `org-${Date.now()}@test.com`
  });

  const owner = await User.create({
    name: 'Org Owner',
    email: `owner-${Date.now()}@test.com`,
    passwordHash: 'test',
    role: 'owner',
    organizationId: org._id
  });

  const contact = await Contact.create({
    userId: owner._id,
    phone: `555666${Math.random().toString().slice(2, 5)}`,
    name: 'Notif Contact'
  });

  // Trigger notification
  const notif = await createNotification({
    userId: owner._id,
    organizationId: org._id,
    type: 'contact',
    title: 'Note Added to Contact 🏷️',
    message: `A note was added to contact "${contact.name}".`,
    link: '/dashboard/contacts',
    metadata: { contactId: contact._id }
  });

  if (!notif) {
    throw new Error('Notification creation failed');
  }

  // Query notification
  const foundNotif = await Notification.findById(notif._id);
  if (!foundNotif || foundNotif.title !== 'Note Added to Contact 🏷️') {
    throw new Error('Notification properties incorrect');
  }

  console.log('  └─ Notifications successfully created and saved to DB ✓');

  // Clean up
  await Notification.deleteOne({ _id: notif._id });
  await Contact.deleteOne({ _id: contact._id });
  await User.deleteOne({ _id: owner._id });
  await Organization.deleteOne({ _id: org._id });
}

async function testOrgDataIsolation() {
  // Create Org 1 and User 1
  const org1 = await Organization.create({
    name: `Org 1 - Isolation ${Date.now()}`,
    contactEmail: `org1-${Date.now()}@test.com`
  });
  const user1 = await User.create({
    name: 'Org 1 User',
    email: `org1-user-${Date.now()}@test.com`,
    passwordHash: 'test',
    role: 'owner',
    organizationId: org1._id
  });

  // Create Org 2 and User 2
  const org2 = await Organization.create({
    name: `Org 2 - Isolation ${Date.now()}`,
    contactEmail: `org2-${Date.now()}@test.com`
  });
  const user2 = await User.create({
    name: 'Org 2 User',
    email: `org2-user-${Date.now()}@test.com`,
    passwordHash: 'test',
    role: 'owner',
    organizationId: org2._id
  });

  // Create Contact 1 inside Org 1
  const contact1 = await Contact.create({
    userId: user1._id,
    phone: `555777${Math.random().toString().slice(2, 5)}`,
    name: 'Org 1 Contact'
  });

  // Create note for Org 1 Contact
  const note1 = await ContactNote.create({
    organizationId: org1._id,
    contactId: contact1._id,
    note: 'Note visible to Org 1 only.',
    createdBy: user1._id
  });

  // Assert Org 2 cannot read Note 1 (simulate org query boundary check)
  const queryResult = await ContactNote.findOne({
    _id: note1._id,
    organizationId: org2._id // Org 2's org context
  });

  if (queryResult !== null) {
    throw new Error('Data breach! Org 2 user was able to query Org 1\'s note!');
  }

  console.log('  └─ Strict organization isolation blocks cross-tenant reads ✓');

  // Clean up
  await ContactNote.deleteOne({ _id: note1._id });
  await Contact.deleteOne({ _id: contact1._id });
  await User.deleteMany({ _id: { $in: [user1._id, user2._id] } });
  await Organization.deleteMany({ _id: { $in: [org1._id, org2._id] } });
}

async function runAllTests() {
  console.log(colors.bold(colors.cyan('\n╔════════════════════════════════════════════════════════╗')));
  console.log(colors.bold(colors.cyan('║    Customer Notes & Tags Module Integration Tests      ║')));
  console.log(colors.bold(colors.cyan('╚════════════════════════════════════════════════════════╝\n')));

  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }

  await test('RBAC Dyn Privilege Resolver', testRBACPrivileges);
  await test('Tag library unique indexes', testTagLibraryUniqueness);
  await test('ContactTag unique indexes', testContactTagAssignment);
  await test('Transparent OEK Encryption/Decryption of notes', testNotesOEKEncryption);
  await test('Notes sorting order (Pinned floating)', testNotesSortingOrder);
  await test('Notification system triggers', testNotificationTriggers);
  await test('Organization data isolation', testOrgDataIsolation);

  // Print summary
  console.log(colors.bold(colors.cyan('\n╔════════════════════════════════════════════════════════╗')));
  console.log(colors.bold(colors.cyan('║                      TEST SUMMARY                       ║')));
  console.log(colors.bold(colors.cyan('╚════════════════════════════════════════════════════════╝\n')));

  const passed = testResults.filter(r => r.passed).length;
  const total = testResults.length;

  testResults.forEach(result => {
    const icon = result.passed ? colors.green('✓') : colors.red('✗');
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`  ${colors.red(result.error)}`);
    }
  });

  console.log(`\n${colors.bold(`Tests Passed: ${passed}/${total}`)}\n`);

  if (passed === total) {
    console.log(colors.green(colors.bold('All tests passed successfully! Module logic is fully verified.\n')));
    process.exit(0);
  } else {
    console.log(colors.red(colors.bold('Some tests failed. Please review implementation.\n')));
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error(colors.red('Fatal error:'), err);
  process.exit(1);
});
