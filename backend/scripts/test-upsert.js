const { connectDB, disconnectDB } = require('../config/db');
const CallLog = require('../models/CallLog');
const mongoose = require('mongoose');

async function run() {
  try {
    await connectDB();
    
    const testLog = {
      userId: new mongoose.Types.ObjectId('6a1c41d8f77b0a66a50dc48d'),
      organizationId: new mongoose.Types.ObjectId('6a1c41d6f77b0a66a50dc48b'),
      phone: '918780564463',
      name: 'Vedant Kalpeshbhai Vaghani',
      duration: 0,
      timestamp: new Date('2026-06-17T17:19:45.020Z'),
      callType: 'rejected',
    };

    console.log('--- TEST 1: Run upsert bulkWrite first time ---');
    const ops1 = [{
      updateOne: {
        filter: {
          userId: testLog.userId,
          phone: testLog.phone,
          timestamp: testLog.timestamp
        },
        update: { $setOnInsert: testLog },
        upsert: true
      }
    }];
    const res1 = await CallLog.bulkWrite(ops1);
    console.log('Result 1:', {
      ok: res1.ok,
      insertedCount: res1.insertedCount,
      upsertedCount: res1.upsertedCount,
      matchedCount: res1.matchedCount,
      modifiedCount: res1.modifiedCount,
      upsertedIds: res1.upsertedIds
    });

    console.log('--- TEST 2: Run upsert bulkWrite second time with same data ---');
    const res2 = await CallLog.bulkWrite(ops1);
    console.log('Result 2:', {
      ok: res2.ok,
      insertedCount: res2.insertedCount,
      upsertedCount: res2.upsertedCount,
      matchedCount: res2.matchedCount,
      modifiedCount: res2.modifiedCount,
      upsertedIds: res2.upsertedIds
    });

    if (res2.matchedCount > 0) {
      console.log('SUCCESS: Matched existing record! (No duplicate created)');
      // Cleanup the test record
      await CallLog.deleteMany({
        userId: testLog.userId,
        phone: testLog.phone,
        timestamp: testLog.timestamp
      });
      console.log('Test record cleaned up.');
    } else {
      console.log('WARNING: Created duplicate record instead of matching!');
    }

    await disconnectDB();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
