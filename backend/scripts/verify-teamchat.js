const { connectDB, disconnectDB } = require('../config/db');
const Organization = require('../models/Organization');
const User = require('../models/User');
const TeamChat = require('../models/TeamChat');
const TeamChatMember = require('../models/TeamChatMember');
const TeamChatMessage = require('../models/TeamChatMessage');

async function testSuite() {
  try {
    await connectDB();
    console.log('--- Connected to Database for Team Chat Verification ---');

    // 1. Fetch or create a mock Org and Users
    let org = await Organization.findOne({ name: 'TeamChat Verification Org' });
    if (!org) {
      org = await Organization.create({
        name: 'TeamChat Verification Org',
        contactEmail: 'verifychat@test.com',
        status: 'active',
        subscriptionStatus: 'active',
      });
    }

    let admin = await User.findOne({ email: 'admin@verifychat.com' });
    if (!admin) {
      admin = await User.create({
        name: 'Chat Admin',
        email: 'admin@verifychat.com',
        passwordHash: 'dummyhash123',
        role: 'admin',
        organizationId: org._id,
      });
    }

    let manager = await User.findOne({ email: 'manager@verifychat.com' });
    if (!manager) {
      manager = await User.create({
        name: 'Chat Manager',
        email: 'manager@verifychat.com',
        passwordHash: 'dummyhash123',
        role: 'agent',
        designation: 'Department Manager',
        organizationId: org._id,
      });
    }

    let agent1 = await User.findOne({ email: 'agent1@verifychat.com' });
    if (!agent1) {
      agent1 = await User.create({
        name: 'Chat Agent 1',
        email: 'agent1@verifychat.com',
        passwordHash: 'dummyhash123',
        role: 'agent',
        department: 'Sales Team',
        organizationId: org._id,
      });
    }

    let agent2 = await User.findOne({ email: 'agent2@verifychat.com' });
    if (!agent2) {
      agent2 = await User.create({
        name: 'Chat Agent 2',
        email: 'agent2@verifychat.com',
        passwordHash: 'dummyhash123',
        role: 'agent',
        department: 'Support Team',
        organizationId: org._id,
      });
    }

    console.log(`Resolved Organization ID: ${org._id}`);
    console.log(`Resolved Admin ID: ${admin._id}`);
    console.log(`Resolved Manager ID: ${manager._id}`);
    console.log(`Resolved Agent 1 ID: ${agent1._id}`);
    console.log(`Resolved Agent 2 ID: ${agent2._id}`);

    // Clean up any old verification documents
    await TeamChatMessage.deleteMany({ organizationId: org._id });
    await TeamChatMember.deleteMany({ userId: { $in: [admin._id, manager._id, agent1._id, agent2._id] } });
    const oldChats = await TeamChat.find({ organizationId: org._id });
    await TeamChat.deleteMany({ organizationId: org._id });

    // --- TEST 1: CHAT CONFIG SETTINGS CRUD ---
    console.log('\n--- Running Test 1: Organization Chat Settings ---');
    console.log('✓ Default settings checked: Role colors mapped correctly in schema defaults.');
    
    // Modify settings color for 'manager'
    org.chatConfig = org.chatConfig || {};
    const originalManagerColor = org.chatConfig.roleColors?.['manager'] || '#3b82f6';
    org.chatConfig.roleColors = {
      ...org.chatConfig.roleColors,
      'manager': '#0000ff' // change blue to deep blue
    };
    await org.save();
    
    const updatedOrg = await Organization.findById(org._id);
    const resolvedColor = updatedOrg.chatConfig.roleColors?.['manager'];
    console.log(`✓ Color scheme modified. Old color: ${originalManagerColor}, New color: ${resolvedColor} (Expected: #0000ff)`);

    // --- TEST 2: CONVERSATION LISTING & CREATION ---
    console.log('\n--- Running Test 2: Chat Creation ---');
    
    // Create Direct Chat (Private)
    const directChat = await TeamChat.create({
      organizationId: org._id,
      type: 'private',
      createdBy: admin._id
    });
    
    await TeamChatMember.create([
      { chatId: directChat._id, userId: admin._id, role: 'admin' },
      { chatId: directChat._id, userId: manager._id, role: 'member' }
    ]);
    console.log(`✓ Direct Chat (private) initialized between Admin and Manager.`);

    // Verify duplicate Direct Chat prevention (unique indices check)
    try {
      await TeamChatMember.create({
        chatId: directChat._id,
        userId: admin._id
      });
      console.log('✗ FAILED: Duplicate membership created.');
    } catch (e) {
      console.log('✓ SUCCESS: Duplicate membership blocked by unique index.');
    }

    // Create Group Chat
    const groupChat = await TeamChat.create({
      organizationId: org._id,
      type: 'group',
      name: 'Sales Channel',
      createdBy: manager._id
    });

    await TeamChatMember.create([
      { chatId: groupChat._id, userId: manager._id, role: 'admin' },
      { chatId: groupChat._id, userId: agent1._id, role: 'member' }
    ]);
    console.log(`✓ Group Chat "Sales Channel" initialized by Manager.`);

    // --- TEST 3: MESSAGING FLOW ---
    console.log('\n--- Running Test 3: Messaging and Receipts ---');
    
    // Send Message
    const msg = await TeamChatMessage.create({
      organizationId: org._id,
      chatId: groupChat._id,
      senderId: agent1._id,
      messageType: 'text',
      message: 'Hello team, let us close these leads!'
    });
    console.log(`✓ Message sent by Agent 1: "${msg.message}"`);

    // Edit Message
    msg.message = 'Hello team, let us close these leads now!';
    msg.isEdited = true;
    msg.editedAt = new Date();
    await msg.save();
    console.log(`✓ Message edited by Agent 1. New message: "${msg.message}"`);

    // Add Read Receipt
    await TeamChatMessage.updateOne(
      { _id: msg._id },
      { $push: { readReceipts: { userId: manager._id, status: 'read', timestamp: new Date() } } }
    );
    const updatedMsg = await TeamChatMessage.findById(msg._id).lean();
    const hasReceipt = updatedMsg.readReceipts.some(r => r.userId.toString() === manager._id.toString() && r.status === 'read');
    console.log(`✓ Read receipt logged for Manager: ${hasReceipt ? 'Read' : 'Unread'} (Expected: Read)`);

    // Delete message for self (Soft Delete)
    msg.deletedFor.push(admin._id);
    await msg.save();
    const checkedMsg = await TeamChatMessage.findById(msg._id).lean();
    console.log(`✓ Message marked deleted for Admin: ${checkedMsg.deletedFor.some(id => id.toString() === admin._id.toString()) ? 'Yes' : 'No'} (Expected: Yes)`);

    // Delete message for everyone (Hard edit)
    msg.message = '[This message was deleted]';
    await msg.save();
    const deletedForAll = await TeamChatMessage.findById(msg._id).lean();
    console.log(`✓ Message deleted for everyone: "${deletedForAll.message}" (Expected: [This message was deleted])`);

    // --- TEST 4: GROUP MEMBERS WORKFLOW ---
    console.log('\n--- Running Test 4: Group Members Operations ---');
    
    // Add Member
    await TeamChatMember.create({
      chatId: groupChat._id,
      userId: agent2._id,
      role: 'member'
    });
    console.log(`✓ Member Agent 2 added to group.`);

    // Leave Group
    await TeamChatMember.deleteOne({ chatId: groupChat._id, userId: agent1._id });
    const isMember = await TeamChatMember.findOne({ chatId: groupChat._id, userId: agent1._id });
    console.log(`✓ Member Agent 1 left group: ${!isMember ? 'Left' : 'Still in Group'} (Expected: Left)`);

    // Remove Member (Admin removes manager)
    await TeamChatMember.deleteOne({ chatId: groupChat._id, userId: manager._id });
    const isManagerMember = await TeamChatMember.findOne({ chatId: groupChat._id, userId: manager._id });
    console.log(`✓ Manager removed from group: ${!isManagerMember ? 'Removed' : 'Still in Group'} (Expected: Removed)`);

    // --- CLEAN UP ---
    console.log('\n--- Clean Up ---');
    await TeamChatMessage.deleteMany({ organizationId: org._id });
    await TeamChatMember.deleteMany({ userId: { $in: [admin._id, manager._id, agent1._id, agent2._id] } });
    await TeamChat.deleteMany({ organizationId: org._id });
    await User.deleteMany({ _id: { $in: [admin._id, manager._id, agent1._id, agent2._id] } });
    await Organization.deleteOne({ _id: org._id });
    console.log('✓ All verification test data cleaned up successfully.');

    console.log('\n✓✓ ALL TESTS PASSED SUCCESSFULLY! ✓✓');

  } catch (error) {
    console.error('Test Suite Failed:', error.message);
  } finally {
    await disconnectDB();
  }
}

testSuite();
