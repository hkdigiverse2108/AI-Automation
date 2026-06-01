const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const BotFlow = require('../models/BotFlow');
const BotMediaAsset = require('../models/BotMediaAsset');
const { verifyToken } = require('../middleware/auth');
const cloudinaryService = require('../services/cloudinaryService');

// Configure multer storage for local file uploads fallback
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: cloudinaryService.isConfigured() ? multer.memoryStorage() : storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(verifyToken);

// 1. GET /api/media/bot/:botId — list all assets for a bot (including direct/virtual canvas images)
router.get('/bot/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const flow = await BotFlow.findOne({ _id: botId, userId: req.userId });
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Bot flow not found' });
    }

    const assets = await BotMediaAsset.find({ botId }).sort('-createdAt');
    
    // We scan nodes in current flow to get live counts of usage
    const nodeUsageMap = {};
    const virtualAssets = [];
    
    for (const node of flow.nodes) {
      if (node.type === 'message' || node.type === 'question') {
        const msg = node.data?.message;
        if (msg?.type === 'image') {
          const key = msg.assetKey || msg.mediaUrl;
          if (key) {
            const isDirectUrl = key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/uploads/');
            if (!isDirectUrl) {
              nodeUsageMap[key] = (nodeUsageMap[key] || 0) + 1;
            } else {
              // This is a direct canvas image used directly in the bot!
              // Let's add it as a virtual unregistered asset so it is displayed dynamically in the media library
              const existingVirtual = virtualAssets.find(v => v.fileUrl === key);
              if (existingVirtual) {
                existingVirtual.usageCount++;
                existingVirtual.nodes.push({ id: node.id, type: node.type, label: msg.text || msg.caption || 'Image Node' });
              } else {
                let fileName = 'direct-canvas-image';
                try {
                  const urlObj = new URL(key.startsWith('/') ? `http://localhost${key}` : key);
                  fileName = path.basename(urlObj.pathname) || 'direct-canvas-image';
                } catch (_) {}

                virtualAssets.push({
                  _id: `virtual_${node.id}`,
                  botId,
                  assetKey: 'UNREGISTERED',
                  fileName,
                  fileUrl: key,
                  fileType: 'image/png',
                  fileSize: 0,
                  usageCount: 1,
                  status: 'used',
                  isVirtual: true,
                  nodes: [{ id: node.id, type: node.type, label: msg.text || msg.caption || 'Image Node' }],
                  createdAt: flow.updatedAt || new Date()
                });
              }
            }
          }
        }
      }
    }

    // Update the usageCounts of registered database assets if they don't match
    for (const asset of assets) {
      const liveCount = nodeUsageMap[asset.assetKey] || 0;
      if (asset.usageCount !== liveCount) {
        asset.usageCount = liveCount;
        asset.status = liveCount > 0 ? 'used' : 'unused';
        await asset.save();
      }
    }

    const allAssets = [...assets, ...virtualAssets];

    res.json({ success: true, data: { assets: allAssets } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch media assets' });
  }
});

// 2. POST /api/media/bot/:botId/upload — upload new media asset
router.post('/bot/:botId/upload', upload.single('file'), async (req, res) => {
  try {
    const { botId } = req.params;
    let { assetKey } = req.body;

    const flow = await BotFlow.findOne({ _id: botId, userId: req.userId });
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Bot flow not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Check if assetKey is provided, else auto generate
    if (!assetKey) {
      const existing = await BotMediaAsset.find({ botId });
      let maxNum = 0;
      existing.forEach(a => {
        const match = a.assetKey.match(/^IMG_(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      assetKey = `IMG_${String(maxNum + 1).padStart(3, '0')}`;
    } else {
      assetKey = assetKey.trim().toUpperCase().replace(/\s+/g, '_');
      // Validate unique key in this bot
      const duplicate = await BotMediaAsset.findOne({ botId, assetKey });
      if (duplicate) {
        return res.status(400).json({ success: false, error: `Asset key "${assetKey}" already exists for this bot.`, code: 'DUPLICATE_KEY' });
      }
    }

    let fileUrl = '';
    if (cloudinaryService.isConfigured()) {
      fileUrl = await cloudinaryService.uploadStream(req.file.buffer, 'bot_media');
    } else {
      fileUrl = `/uploads/${req.file.filename}`;
    }

    const asset = await BotMediaAsset.create({
      botId,
      assetKey,
      fileName: req.file.originalname,
      fileUrl,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      usageCount: 0,
      status: 'unused',
      createdBy: req.userId
    });

    res.status(201).json({ success: true, data: { asset } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
  }
});

// 3. POST /api/media/bot/:botId/replace/:assetId — replace an asset's media file globally
router.post('/bot/:botId/replace/:assetId', upload.single('file'), async (req, res) => {
  try {
    const { botId, assetId } = req.params;

    const flow = await BotFlow.findOne({ _id: botId, userId: req.userId });
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Bot flow not found' });
    }

    const asset = await BotMediaAsset.findOne({ _id: assetId, botId });
    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    let fileUrl = '';
    if (cloudinaryService.isConfigured()) {
      fileUrl = await cloudinaryService.uploadStream(req.file.buffer, 'bot_media');
    } else {
      fileUrl = `/uploads/${req.file.filename}`;
    }

    // Update asset details
    asset.fileName = req.file.originalname;
    asset.fileUrl = fileUrl;
    asset.fileType = req.file.mimetype;
    asset.fileSize = req.file.size;
    await asset.save();

    res.json({ success: true, data: { asset }, message: 'Asset image replaced successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Replacement failed: ' + error.message });
  }
});

// 4. PUT /api/media/bot/:botId/rename/:assetId — rename assetKey
router.put('/bot/:botId/rename/:assetId', async (req, res) => {
  try {
    const { botId, assetId } = req.params;
    let { newAssetKey } = req.body;

    if (!newAssetKey) {
      return res.status(400).json({ success: false, error: 'New asset key is required' });
    }

    newAssetKey = newAssetKey.trim().toUpperCase().replace(/\s+/g, '_');

    const flow = await BotFlow.findOne({ _id: botId, userId: req.userId });
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Bot flow not found' });
    }

    const asset = await BotMediaAsset.findOne({ _id: assetId, botId });
    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    if (asset.assetKey === newAssetKey) {
      return res.json({ success: true, data: { asset }, message: 'Key is identical' });
    }

    // Check if new key is already in use by another asset in this bot
    const duplicate = await BotMediaAsset.findOne({ botId, assetKey: newAssetKey });
    if (duplicate) {
      return res.status(400).json({ success: false, error: `Key "${newAssetKey}" is already in use by another asset.`, code: 'DUPLICATE_KEY' });
    }

    const oldKey = asset.assetKey;
    asset.assetKey = newAssetKey;
    await asset.save();

    // Now update references in the BotFlow schema!
    let flowModified = false;
    flow.nodes = flow.nodes.map(node => {
      if (node.type === 'message' || node.type === 'question') {
        const msg = node.data?.message;
        if (msg?.type === 'image') {
          if (msg.assetKey === oldKey) {
            msg.assetKey = newAssetKey;
            flowModified = true;
          }
          if (msg.mediaUrl === oldKey) {
            msg.mediaUrl = newAssetKey;
            flowModified = true;
          }
        }
      }
      return node;
    });

    if (flowModified) {
      flow.markModified('nodes');
      await flow.save();
    }

    res.json({ success: true, data: { asset }, message: `Key successfully renamed from ${oldKey} to ${newAssetKey}. Reference nodes updated.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Renaming failed: ' + error.message });
  }
});

// 5. DELETE /api/media/bot/:botId/:assetId — delete an unused asset safely
router.delete('/bot/:botId/:assetId', async (req, res) => {
  try {
    const { botId, assetId } = req.params;

    const flow = await BotFlow.findOne({ _id: botId, userId: req.userId });
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Bot flow not found' });
    }

    const asset = await BotMediaAsset.findOne({ _id: assetId, botId });
    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    // Double check if it is used in flow nodes
    const inUseNodes = [];
    for (const node of flow.nodes) {
      if (node.type === 'message' || node.type === 'question') {
        const msg = node.data?.message;
        if (msg?.type === 'image') {
          if (msg.assetKey === asset.assetKey || msg.mediaUrl === asset.assetKey) {
            inUseNodes.push({ id: node.id, type: node.type, label: node.data?.message?.text || 'Image Node' });
          }
        }
      }
    }

    if (inUseNodes.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete asset. It is in use by ${inUseNodes.length} active node(s).`,
        code: 'ASSET_IN_USE',
        nodes: inUseNodes
      });
    }

    await BotMediaAsset.deleteOne({ _id: assetId });
    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Deletion failed: ' + error.message });
  }
});

// 6. POST /api/media/bot/:botId/scan-sync — scans legacy workflows and auto-migrates image URLs to assets
router.post('/bot/:botId/scan-sync', async (req, res) => {
  try {
    const { botId } = req.params;
    const flow = await BotFlow.findOne({ _id: botId, userId: req.userId });
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Bot flow not found' });
    }

    const existingAssets = await BotMediaAsset.find({ botId });
    const urlMap = {}; // Maps URL -> asset
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
    const migratedNodes = [];

    // Let's scan all nodes for image templates
    flow.nodes = await Promise.all(flow.nodes.map(async (node) => {
      if (node.type === 'message' || node.type === 'question') {
        const msg = node.data?.message;
        if (msg?.type === 'image' && msg.mediaUrl) {
          const currentUrl = msg.mediaUrl.trim();
          
          // Check if it's already an assetKey
          const isUrl = currentUrl.startsWith('http://') || currentUrl.startsWith('https://') || currentUrl.startsWith('/uploads/');
          
          if (isUrl && !msg.assetKey) {
            // It is a hardcoded URL!
            // Let's see if we already have an asset with this URL
            let asset = urlMap[currentUrl];
            if (!asset) {
              // Create a new asset for this URL!
              maxNum++;
              const newKey = `IMG_${String(maxNum).padStart(3, '0')}`;
              
              // Derive fileName from URL
              let fileName = 'migrated-asset';
              try {
                const urlObj = new URL(currentUrl.startsWith('/') ? `http://localhost${currentUrl}` : currentUrl);
                fileName = path.basename(urlObj.pathname) || 'migrated-asset';
              } catch (_) {}

              asset = await BotMediaAsset.create({
                botId,
                assetKey: newKey,
                fileName,
                fileUrl: currentUrl,
                fileType: 'image/png', // default
                fileSize: 0,
                usageCount: 1,
                status: 'used',
                createdBy: req.userId
              });
              urlMap[currentUrl] = asset;
            }

            // Reference it
            msg.assetKey = asset.assetKey;
            msg.mediaUrl = asset.assetKey; // Replace URL with key
            flowModified = true;
            migratedNodes.push({ id: node.id, key: asset.assetKey, url: currentUrl });
          }
        }
      }
      return node;
    }));

    if (flowModified) {
      flow.markModified('nodes');
      await flow.save();
    }

    res.json({
      success: true,
      migratedCount: migratedNodes.length,
      migratedNodes,
      message: `Legacy migration scan completed. Successfully auto-converted ${migratedNodes.length} hardcoded image nodes to managed assets.`
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Migration scan failed: ' + error.message });
  }
});

// 7. POST /api/media/bot/:botId/register-virtual — register a direct/virtual image as a central asset
router.post('/bot/:botId/register-virtual', async (req, res) => {
  try {
    const { botId } = req.params;
    let { fileUrl, assetKey } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ success: false, error: 'File URL is required' });
    }

    const flow = await BotFlow.findOne({ _id: botId, userId: req.userId });
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Bot flow not found' });
    }

    // Autogenerate or sanitize assetKey
    if (!assetKey) {
      const existing = await BotMediaAsset.find({ botId });
      let maxNum = 0;
      existing.forEach(a => {
        const match = a.assetKey.match(/^IMG_(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      assetKey = `IMG_${String(maxNum + 1).padStart(3, '0')}`;
    } else {
      assetKey = assetKey.trim().toUpperCase().replace(/\s+/g, '_');
      const duplicate = await BotMediaAsset.findOne({ botId, assetKey });
      if (duplicate) {
        return res.status(400).json({ success: false, error: `Asset key "${assetKey}" already exists.`, code: 'DUPLICATE_KEY' });
      }
    }

    // Derive fileName from URL
    let fileName = 'registered-asset';
    try {
      const urlObj = new URL(fileUrl.startsWith('/') ? `http://localhost${fileUrl}` : fileUrl);
      fileName = path.basename(urlObj.pathname) || 'registered-asset';
    } catch (_) {}

    // Create the asset entry
    const asset = await BotMediaAsset.create({
      botId,
      assetKey,
      fileName,
      fileUrl,
      fileType: 'image/png',
      fileSize: 0,
      usageCount: 0, // will count next
      status: 'used',
      createdBy: req.userId
    });

    // Update all matching nodes in the BotFlow to reference the new key
    let flowModified = false;
    let registeredCount = 0;
    flow.nodes = flow.nodes.map(node => {
      if (node.type === 'message' || node.type === 'question') {
        const msg = node.data?.message;
        if (msg?.type === 'image' && msg.mediaUrl === fileUrl && !msg.assetKey) {
          msg.assetKey = assetKey;
          msg.mediaUrl = assetKey;
          flowModified = true;
          registeredCount++;
        }
      }
      return node;
    });

    if (flowModified) {
      flow.markModified('nodes');
      await flow.save();
    }

    asset.usageCount = registeredCount;
    asset.status = registeredCount > 0 ? 'used' : 'unused';
    await asset.save();

    res.status(201).json({ success: true, data: { asset }, message: `Successfully registered direct image as asset "${assetKey}" and updated ${registeredCount} flow nodes.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Registration failed: ' + error.message });
  }
});

module.exports = router;
