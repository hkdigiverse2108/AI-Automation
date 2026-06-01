const { connectDB, disconnectDB } = require('../config/db');
const BotFlow = require('../models/BotFlow');
const BotMediaAsset = require('../models/BotMediaAsset');
const path = require('path');

async function run() {
  try {
    await connectDB();
    console.log('Successfully connected to database. Starting canvas image migration...');

    const flows = await BotFlow.find({});
    console.log(`Found ${flows.length} bot flows to scan.`);

    let totalMigrated = 0;

    for (const flow of flows) {
      console.log(`Scanning Bot Flow: "${flow.name}" (ID: ${flow._id})...`);
      
      const existingAssets = await BotMediaAsset.find({ botId: flow._id });
      const urlMap = {};
      existingAssets.forEach(a => {
        urlMap[a.fileUrl] = a;
      });

      let maxNum = 0;
      existingAssets.forEach(a => {
        const match = a.assetKey.match(/^IMG_(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });

      let flowModified = false;
      let flowMigratedCount = 0;

      for (let i = 0; i < flow.nodes.length; i++) {
        const node = flow.nodes[i];
        if (node.type === 'message' || node.type === 'question') {
          const msg = node.data?.message;
          if (msg?.type === 'image' && msg.mediaUrl) {
            const currentUrl = msg.mediaUrl.trim();
            const isUrl = currentUrl.startsWith('http://') || currentUrl.startsWith('https://') || currentUrl.startsWith('/uploads/');
            
            if (isUrl && !msg.assetKey) {
              // Found a hardcoded URL!
              console.log(`  -> Found hardcoded image URL inside Node "${node.id}": "${currentUrl}"`);
              
              let asset = urlMap[currentUrl];
              if (!asset) {
                maxNum++;
                const newKey = `IMG_${String(maxNum).padStart(3, '0')}`;
                
                let fileName = 'migrated-asset';
                try {
                  const urlObj = new URL(currentUrl.startsWith('/') ? `http://localhost${currentUrl}` : currentUrl);
                  fileName = path.basename(urlObj.pathname) || 'migrated-asset';
                } catch (_) {}

                // Synthesize createdBy as the flow's owner
                asset = await BotMediaAsset.create({
                  botId: flow._id,
                  assetKey: newKey,
                  fileName,
                  fileUrl: currentUrl,
                  fileType: 'image/png',
                  fileSize: 0,
                  usageCount: 1,
                  status: 'used',
                  createdBy: flow.userId
                });
                
                urlMap[currentUrl] = asset;
                console.log(`     Created new Central Asset Key: "${newKey}"`);
              } else {
                asset.usageCount++;
                asset.status = 'used';
                await asset.save();
                console.log(`     Matched existing Central Asset Key: "${asset.assetKey}"`);
              }

              // Update the node message config
              msg.assetKey = asset.assetKey;
              msg.mediaUrl = asset.assetKey; // Replace URL with asset key
              flowModified = true;
              flowMigratedCount++;
              totalMigrated++;
            }
          }
        }
      }

      if (flowModified) {
        flow.markModified('nodes');
        await flow.save();
        console.log(`  [SUCCESS] Successfully migrated ${flowMigratedCount} hardcoded nodes in flow "${flow.name}".`);
      } else {
        console.log(`  No hardcoded legacy image URLs found in flow "${flow.name}".`);
      }
    }

    console.log(`\n========================================`);
    console.log(`MIGRATION COMPLETE!`);
    console.log(`Successfully migrated ${totalMigrated} hardcoded image nodes to central managed assets globally.`);
    console.log(`========================================`);

    await disconnectDB();
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

run();
