const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const Template = require('../models/Template');
const whatsappService = require('../services/whatsapp');
const { decryptField } = require('../services/encryption');

async function run() {
  try {
    await connectDB();
    const user = await User.findOne({ email: 'princegajera0506@gmail.com' });
    if (!user) {
      console.log('User not found!');
      await disconnectDB();
      return;
    }
    console.log(`User found: ${user.email} (${user._id})`);

    const waAccount = await WhatsAppAccount.findOne({ userId: user._id, isActive: true });
    if (!waAccount) {
      console.log('No active WhatsApp account found!');
      await disconnectDB();
      return;
    }

    console.log(`WhatsApp Account found: WABA ID = ${waAccount.wabaId}, Phone ID = ${waAccount.phoneNumberId}`);

    const token = decryptField(waAccount.accessToken);
    console.log('Fetching templates from Meta API...');
    const result = await whatsappService.getTemplates(waAccount.wabaId, token);
    
    if (!result.success) {
      console.error('Failed to fetch templates from Meta:', result.error || 'Unknown Meta error');
      await disconnectDB();
      return;
    }

    const metaTemplates = result.data?.data || [];
    console.log(`Successfully fetched ${metaTemplates.length} templates from Meta:`);
    console.log(JSON.stringify(metaTemplates, null, 2));

    let synced = 0;
    for (const mt of metaTemplates) {
      await Template.findOneAndUpdate(
        { userId: user._id, metaTemplateId: mt.id },
        {
          userId: user._id,
          name: mt.name,
          metaTemplateId: mt.id,
          category: mt.category,
          language: mt.language,
          status: mt.status,
          components: mt.components || [],
          variableCount: (mt.components || []).reduce((acc, c) => {
            const matches = (c.text || '').match(/\{\{[0-9]+\}\}/g);
            return acc + (matches ? matches.length : 0);
          }, 0),
        },
        { upsert: true, new: true }
      );
      synced++;
    }

    console.log(`\nSuccessfully synced ${synced} templates in the local database!`);
    await disconnectDB();
  } catch (err) {
    console.error('Error during execution:', err.message);
  }
}

run();
