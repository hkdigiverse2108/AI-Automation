const mongoose = require('mongoose');
const env = require('../config/env');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const queueService = require('../services/queueService');

async function test() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected.');

    const user = await User.findOne({ isDeleted: { $ne: true } });
    if (!user) {
      console.log('❌ No user found. Create a user first.');
      process.exit(1);
    }

    console.log('Creating mock media campaign...');
    const campaign = await Campaign.create({
      userId: user._id,
      name: 'Test Image Blast Campaign',
      templateName: 'WELCOME_PROMO_BLAST',
      templateId: 'tpl_12345',
      audience: { type: 'all' },
      variables: ['Alice', '20', 'SAVE20'],
      headerMediaId: 'mock_image_media_id_99999',
      status: 'draft',
    });

    console.log('✅ Campaign document created successfully with headerMediaId:', campaign.headerMediaId);

    // Make sure we have an active WhatsApp account linked
    let waAccount = await WhatsAppAccount.findOne({ userId: user._id });
    if (!waAccount) {
      console.log('Linking mock WhatsApp account first...');
      const { encryptField } = require('../services/encryption');
      waAccount = await WhatsAppAccount.create({
        userId: user._id,
        phoneNumber: '+14155552671',
        phoneNumberId: 'mock_phone_number_id',
        accessToken: encryptField('mock'),
        wabaId: 'mock_waba_id',
        displayName: 'Mock Business Sandbox',
        isActive: true,
      });
    }

    console.log('Initializing Bull queues inside server context...');
    // We need to initialize the queues since we are in a standalone script
    const mockIo = {
      to: () => ({
        emit: () => {}
      })
    };
    queueService.initQueues(mockIo);

    console.log('Starting Campaign (pushing jobs to Bull queue)...');
    const result = await queueService.startCampaign(campaign._id, user._id);
    console.log('Campaign launch job counts:', result);

    // Let's verify that the campaign in DB changed status to running
    const updatedCampaign = await Campaign.findById(campaign._id);
    console.log('Campaign status updated to:', updatedCampaign.status);

    console.log('\nWaiting 3 seconds for Bull queue to process jobs...');
    await new Promise(r => setTimeout(r, 3000));

    console.log('\nCleaning up verification campaign...');
    await Campaign.deleteOne({ _id: campaign._id });
    console.log('✅ Verification completed successfully.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err.message, err.stack);
    try { await mongoose.disconnect(); } catch(e) {}
    process.exit(1);
  }
}

test();
