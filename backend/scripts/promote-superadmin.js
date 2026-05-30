const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
  console.error('ERROR: Please provide a user email as an argument.');
  console.log('Usage: node scripts/promote-superadmin.js <email>');
  process.exit(1);
}

async function run() {
  try {
    console.log(`Connecting to database...`);
    await connectDB();

    console.log(`Searching for user with email: ${email}`);
    const user = await User.findOne({ email, isDeleted: { $ne: true } });

    if (!user) {
      console.error(`ERROR: Active user not found with email: ${email}`);
      await disconnectDB();
      process.exit(1);
    }

    console.log(`User found: ${user.name} (Current Role: ${user.role})`);
    
    if (user.role === 'superadmin') {
      console.log(`User is already a superadmin.`);
      await disconnectDB();
      process.exit(0);
    }

    user.role = 'superadmin';
    await user.save();

    console.log(`SUCCESS: User ${user.email} has been promoted to superadmin!`);
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error(`FATAL ERROR:`, err.message);
    process.exit(1);
  }
}

run();
