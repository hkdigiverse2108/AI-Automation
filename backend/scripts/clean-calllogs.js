const { connectDB, disconnectDB } = require('../config/db');
const CallLog = require('../models/CallLog');

async function run() {
  try {
    await connectDB();
    console.log('Fetching all call logs stats...');

    const totalCount = await CallLog.countDocuments();
    console.log(`Total call log records in database: ${totalCount}`);

    console.log('Finding duplicates...');
    const duplicates = await CallLog.aggregate([
      {
        $group: {
          _id: {
            userId: '$userId',
            phone: '$phone',
            timestamp: '$timestamp'
          },
          ids: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).allowDiskUse(true);

    console.log(`Found ${duplicates.length} groups with duplicate entries.`);

    let deleteIds = [];
    let keptCount = 0;

    for (const group of duplicates) {
      // Keep the first one (earliest/original), delete the rest
      const [keep, ...toDelete] = group.ids;
      deleteIds.push(...toDelete);
      keptCount++;
    }

    console.log(`Total duplicates to delete: ${deleteIds.length}`);
    console.log(`Unique records to keep from duplicate groups: ${keptCount}`);

    if (deleteIds.length === 0) {
      console.log('No duplicates found. Database is clean!');
      await disconnectDB();
      return;
    }

    // Delete in batches of 5000 to avoid overwhelming the DB
    const batchSize = 5000;
    let deletedCount = 0;
    
    for (let i = 0; i < deleteIds.length; i += batchSize) {
      const batch = deleteIds.slice(i, i + batchSize);
      const res = await CallLog.deleteMany({ _id: { $in: batch } });
      deletedCount += res.deletedCount;
      console.log(`Deleted ${deletedCount} / ${deleteIds.length} duplicate call logs...`);
    }

    console.log('Cleanup completed successfully!');
    const finalCount = await CallLog.countDocuments();
    console.log(`Final call log records in database: ${finalCount}`);

    await disconnectDB();
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}

run();
