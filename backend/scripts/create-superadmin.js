const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Organization = require('../models/Organization');

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || 'Super Admin';

if (!email || !password) {
  console.error('ERROR: Missing required arguments.');
  console.log('Usage: node scripts/create-superadmin.js <email> <password> "[name]"');
  process.exit(1);
}

async function run() {
  try {
    console.log(`Connecting to database...`);
    await connectDB();

    console.log(`Checking if email is already in use: ${email}`);
    const existing = await User.findOne({ email });
    if (existing) {
      console.error(`ERROR: User already exists with email: ${email}`);
      await disconnectDB();
      process.exit(1);
    }

    console.log(`Creating default Organization for Super Admin...`);
    const org = await Organization.create({
      name: `Super Admin Organization`,
      contactEmail: email,
      plan: 'enterprise',
      status: 'active'
    });

    console.log(`Hashing password...`);
    const passwordHash = await User.hashPassword(password);

    console.log(`Creating Super Admin user...`);
    const user = await User.create({
      name,
      email,
      passwordHash,
      passwordHistory: [passwordHash],
      isEmailVerified: true,
      role: 'superadmin',
      plan: 'enterprise',
      organizationId: org._id
    });

    console.log(`\n✅ SUCCESS: Super Admin user "${user.name}" (${user.email}) created successfully!`);
    console.log(`Associated Organization: "${org.name}"`);

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error(`❌ FATAL ERROR:`, err.message);
    try { await disconnectDB(); } catch (_) {}
    process.exit(1);
  }
}

run();
