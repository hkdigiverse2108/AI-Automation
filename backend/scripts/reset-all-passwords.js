const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const User = require('../models/User');
const { connectDB, disconnectDB } = require('../config/db');

async function run() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    const users = await User.find({ isDeleted: { $ne: true } });
    console.log(`Found ${users.length} active users. Updating passwords to "admin123"...`);

    const passwordHash = await User.hashPassword('admin123');

    for (const user of users) {
      user.passwordHash = passwordHash;
      user.passwordHistory = [passwordHash];
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
      console.log(`✅ Password updated for: ${user.email} (${user.role})`);
    }

    console.log('\n🎉 All user passwords have been successfully updated to: admin123');
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating passwords:', err);
    try { await disconnectDB(); } catch (_) {}
    process.exit(1);
  }
}

run();
