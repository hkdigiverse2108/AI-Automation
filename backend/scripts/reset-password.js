const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('ERROR: Missing required arguments.');
  console.log('Usage: node scripts/reset-password.js <email> <new_password>');
  process.exit(1);
}

async function run() {
  try {
    console.log(`Connecting to database...`);
    await connectDB();

    console.log(`Searching for user: ${email}`);
    const user = await User.findOne({ email, isDeleted: { $ne: true } });

    if (!user) {
      console.error(`ERROR: Active user not found with email: ${email}`);
      await disconnectDB();
      process.exit(1);
    }

    console.log(`User found: ${user.name}`);
    console.log(`Hashing new password...`);
    const passwordHash = await User.hashPassword(newPassword);

    user.passwordHash = passwordHash;
    user.passwordHistory = [passwordHash];
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    
    await user.save();

    console.log(`\n✅ SUCCESS: Password for user "${user.email}" has been successfully reset!`);

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error(`❌ FATAL ERROR:`, err.message);
    try { await disconnectDB(); } catch (_) {}
    process.exit(1);
  }
}

run();
