const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/db');
const Contact = require('./models/Contact');
const Conversation = require('./models/Conversation');
const Category = require('./models/Category');
const Product = require('./models/Product');

async function check() {
  console.log('Connecting to DB...');
  await connectDB();

  try {
    const contacts = await Contact.find({}).lean();
    console.log(`Fetched ${contacts.length} total contacts.`);
    
    // Decrypt manually if lean was used, or query without lean to let mongoose hooks do it.
    // Let's run a query without lean:
    const mongooseContacts = await Contact.find({});
    console.log(`Found ${mongooseContacts.length} mongoose contacts.`);
    
    let targetContact = null;
    for (const c of mongooseContacts) {
      if (c.phone && (c.phone.includes('6355809873') || c.phone.includes('916355809873'))) {
        targetContact = c;
        break;
      }
    }

    if (!targetContact) {
      console.log('Target contact with phone containing 6355809873 not found.');
      // Let's print all contact phones to see what they are:
      mongooseContacts.forEach(c => {
        console.log(`- Contact Name: ${c.name}, Phone: ${c.phone}, encrypted: ${c.isEncrypted}`);
      });
      return;
    }

    console.log('\n--- Found Contact ---');
    console.log({
      _id: targetContact._id,
      phone: targetContact.phone,
      name: targetContact.name,
      userId: targetContact.userId,
      isEncrypted: targetContact.isEncrypted
    });

    const conversations = await Conversation.find({ contactId: targetContact._id }).lean();
    console.log('\n--- Conversations ---');
    console.log(JSON.stringify(conversations, null, 2));

    const conversation = conversations[0];
    if (conversation) {
      const orgId = conversation.organization_id || conversation.organizationId;
      console.log(`\nUsing organization ID: ${orgId}`);

      const categories = await Category.find({ organizationId: orgId }).lean();
      console.log(`\n--- Categories (${categories.length}) ---`);
      console.log(JSON.stringify(categories, null, 2));

      const products = await Product.find({ organizationId: orgId }).lean();
      console.log(`\n--- Products (${products.length}) ---`);
      console.log(JSON.stringify(products, null, 2));
    }

  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    await disconnectDB();
  }
}

check();
