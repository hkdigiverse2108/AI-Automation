const { connectDB } = require('../config/db');
const User = require('../models/User');
const Organization = require('../models/Organization');
const WhatsAppAccount = require('../models/WhatsAppAccount');

async function main() {
  try {
    await connectDB();
    const orgs = await Organization.find({}).lean();
    console.log('--- ORGANIZATIONS ---');
    orgs.forEach(o => console.log(`Org: ${o._id}, Name: ${o.name}`));

    const users = await User.find({}).lean();
    console.log('\n--- USERS ---');
    users.forEach(u => console.log(`User: ${u._id}, Email: ${u.email}, Org: ${u.organizationId}, Role: ${u.role}`));

    const wa = await WhatsAppAccount.find({}).lean();
    console.log('\n--- WA ACCOUNTS ---');
    wa.forEach(w => console.log(`WA: ${w._id}, User: ${w.userId}, Phone: ${w.phoneNumber || w.phone}, Active: ${w.isActive}, PhoneId: ${w.phoneNumberId}`));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
main();
