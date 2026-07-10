const { connectDB, disconnectDB } = require('../config/db');
const Contact = require('../models/Contact');
const User = require('../models/User');

async function run() {
  try {
    await connectDB();
    console.log('Connected to DB. Fetching contacts...');
    
    // Find the user for hk@gmail.com
    const user = await User.findOne({ email: 'hk@gmail.com' });
    if (!user) {
      console.log('User hk@gmail.com not found.');
      await disconnectDB();
      return;
    }
    console.log(`Found user: ${user.name} (${user._id})`);

    // Fetch contacts for this user
    const contacts = await Contact.find({ userId: user._id });
    console.log(`Found ${contacts.length} total contacts for this user.`);

    console.log('--- ALL CONTACTS FOR hk@gmail.com ---');
    contacts.forEach((c, index) => {
      console.log(`[${index + 1}] Name: "${c.name}", Phone: "${c.phone}", Email: "${c.email}", Tags: ${JSON.stringify(c.tags)}, Custom: ${JSON.stringify(c.customFields)}`);
    });

    await disconnectDB();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
