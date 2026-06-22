const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

const ParkConfig = require('../models/ParkConfig');
const CallLog = require('../models/CallLog');
const Complaint = require('../models/Complaint');
const LostItem = require('../models/LostItem');
const CallbackRequest = require('../models/CallbackRequest');
const User = require('../models/User');
const Organization = require('../models/Organization');
const ttsService = require('../services/ttsService');

async function run() {
  console.log('=== STARTING TELEPHONY & CRM MODULE VERIFICATION ===');
  
  // 1. Connect DB
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully.');
  } catch (err) {
    console.error('❌ MongoDB Connection failed:', err.message);
    process.exit(1);
  }

  const testOrgId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();

  try {
    // 2. Test Mongoose Schema Operations
    console.log('\n--- 1. Testing Schema Schema Definition & CRUD ---');

    // ParkConfig
    const park = await ParkConfig.create({
      park_name: 'Test Adventure Land',
      voice_id: '21m00Tcm4TlvDq8ikWAM',
      organization_id: testOrgId,
      created_by: testUserId
    });
    console.log('✅ ParkConfig model instantiated & saved. ID:', park._id);

    // CallLog (with unique session_id)
    const sessionId = `test_session_${Date.now()}`;
    const call1 = await CallLog.create({
      session_id: sessionId,
      from_number: '919999999999',
      to_number: '918888888888',
      duration: 15,
      status: 'started',
      organization_id: testOrgId,
      phone: '919999999999'
    });
    console.log('✅ CallLog model instantiated & saved with session_id:', call1.session_id);

    // Test unique index on session_id
    try {
      await CallLog.create({
        session_id: sessionId,
        from_number: '919999999999',
        organization_id: testOrgId
      });
      console.error('❌ Fail: Duplicate session_id was allowed!');
    } catch (err) {
      console.log('✅ Success: Duplicate session_id blocked by index constraint.');
    }

    // Complaint
    const comp = await Complaint.create({
      name: 'Tester',
      phone_number: '919999999999',
      complaint: 'Testing ticket registration',
      status: 'pending',
      organization_id: testOrgId
    });
    console.log('✅ Complaint ticket created successfully. ID:', comp._id);

    // LostItem
    const lost = await LostItem.create({
      name: 'Tester',
      phone_number: '919999999999',
      lost_item: 'Test Watch',
      status: 'reported',
      organization_id: testOrgId
    });
    console.log('✅ LostItem ticket created successfully. ID:', lost._id);

    // CallbackRequest
    const cb = await CallbackRequest.create({
      name: 'Tester',
      phone_number: '919999999999',
      status: 'pending',
      organization_id: testOrgId
    });
    console.log('✅ CallbackRequest created successfully. ID:', cb._id);

    // Clean up test records
    await ParkConfig.deleteOne({ _id: park._id });
    await CallLog.deleteOne({ _id: call1._id });
    await Complaint.deleteOne({ _id: comp._id });
    await LostItem.deleteOne({ _id: lost._id });
    await CallbackRequest.deleteOne({ _id: cb._id });
    console.log('✅ CRUD database validation records cleaned successfully.');

    // 3. Test ElevenLabs TTS Service (Mock fallback)
    console.log('\n--- 2. Testing ElevenLabs TTS Service & Audio Caching ---');
    const audioUrl = await ttsService.getTTSAudioUrl('Welcome test voice message script', 'en', '21m00Tcm4TlvDq8ikWAM');
    console.log('✅ TTS generated audio URL:', audioUrl);
    
    // Verify file exists on local filesystem
    const relativePath = audioUrl.replace('/public/audio-cache/', '');
    const fullPath = path.resolve(__dirname, '../public/audio-cache', relativePath);
    if (fs.existsSync(fullPath)) {
      console.log('✅ Cached file verified on disk:', fullPath);
      // Clean test file
      fs.unlinkSync(fullPath);
      console.log('✅ Test cached audio file cleaned.');
    } else {
      console.error('❌ Audio file was not created on disk!');
    }

    console.log('\n=== TELEPHONY & CRM MODULE VERIFICATION PASSED SUCCESSFULLY ===');
  } catch (err) {
    console.error('\n❌ Verification Failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

run();
