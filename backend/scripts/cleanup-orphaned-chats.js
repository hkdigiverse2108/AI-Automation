const { connectDB, disconnectDB } = require('../config/db');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

async function run() {
  try {
    await connectDB();
    console.log('\n--- SCANNING FOR ORPHANED CHATS ---');

    // 1. Fetch all active (not deleted) contacts
    const activeContactsList = await Contact.find({ isDeleted: { $ne: true } }).lean();
    const activeContactIdsSet = new Set(activeContactsList.map(c => c._id.toString()));
    console.log(`Found ${activeContactsList.length} active contacts in the database.`);

    // 2. Fetch all conversations
    const allConversations = await Conversation.find({}).lean();
    console.log(`Found ${allConversations.length} total conversations in the database.`);

    // 3. Find conversations where the contact does not exist or is soft-deleted
    const orphanedConversations = [];
    for (const conv of allConversations) {
      const contactIdStr = conv.contactId ? conv.contactId.toString() : null;
      if (!contactIdStr || !activeContactIdsSet.has(contactIdStr)) {
        orphanedConversations.push(conv);
      }
    }

    console.log(`Identified ${orphanedConversations.length} orphaned conversations to delete.`);

    if (orphanedConversations.length === 0) {
      console.log('No orphaned conversations found. Database is clean!');
      await disconnectDB();
      return;
    }

    // 4. Perform deletion
    let deletedConversationsCount = 0;
    let deletedMessagesCount = 0;

    for (const conv of orphanedConversations) {
      const convId = conv._id;
      console.log(`Deleting conversation ID: ${convId} (Contact ID: ${conv.contactId || 'None'})`);
      
      // Delete the conversation
      const convDelResult = await Conversation.deleteOne({ _id: convId });
      deletedConversationsCount += convDelResult.deletedCount;

      // Delete the associated messages
      const msgDelResult = await Message.deleteMany({ conversationId: convId });
      deletedMessagesCount += msgDelResult.deletedCount;
      console.log(`  -> Deleted ${msgDelResult.deletedCount} messages associated with conversation ${convId}`);
    }

    // 5. Also check for orphaned messages that might have no conversation or no contact
    console.log('\nScanning for any remaining orphaned messages without active contacts...');
    const messageContactIds = await Message.distinct('contactId');
    const orphanedMessageContactIds = messageContactIds.filter(cid => !activeContactIdsSet.has(cid.toString()));
    
    if (orphanedMessageContactIds.length > 0) {
      console.log(`Found messages linked to ${orphanedMessageContactIds.length} invalid/deleted contact IDs. Cleaning up...`);
      const extraMsgDel = await Message.deleteMany({ contactId: { $in: orphanedMessageContactIds } });
      deletedMessagesCount += extraMsgDel.deletedCount;
      console.log(`  -> Deleted an additional ${extraMsgDel.deletedCount} orphaned messages.`);
    }

    console.log('\n--- CLEANUP COMPLETE ---');
    console.log(`Total conversations deleted: ${deletedConversationsCount}`);
    console.log(`Total messages deleted: ${deletedMessagesCount}`);

    await disconnectDB();
  } catch (err) {
    console.error('Error during cleanup:', err);
    try {
      await disconnectDB();
    } catch (_) {}
  }
}

run();
