const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

async function run() {
  try {
    await connectDB();
    const users = await User.find({}).lean();
    console.log('--- USERS IN DATABASE ---');
    if (users.length === 0) {
      console.log('No users found in database.');
    } else {
      users.forEach(u => {
        console.log(`- ID: ${u._id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, Suspended: ${u.isSuspended}`);
      });
    }
    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
