const { connectDB, disconnectDB } = require('../config/db');
const Contact = require('../models/Contact');
const User = require('../models/User');

async function run() {
  try {
    await connectDB();
    const user = await User.findOne({ email: 'hk@gmail.com' });
    if (!user) {
      console.log('User hk@gmail.com not found.');
      await disconnectDB();
      return;
    }

    const contacts = await Contact.find({ userId: user._id });
    
    const leads = contacts.map(c => {
      const custom = c.customFields ? (c.customFields.toJSON ? c.customFields.toJSON() : c.customFields) : {};
      const category = custom.businessCategory || custom.business_category || custom.business_name || 'N/A';
      return {
        name: c.name || 'N/A',
        phone: c.phone || 'N/A',
        category: category,
        status: custom.conversationStatus || 'N/A',
        tags: c.tags && c.tags.length ? c.tags.join(', ') : 'N/A'
      };
    });

    console.log(JSON.stringify(leads, null, 2));

    await disconnectDB();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
