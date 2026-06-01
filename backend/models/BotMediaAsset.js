const mongoose = require('mongoose');

const botMediaAssetSchema = new mongoose.Schema(
  {
    botId: { type: mongoose.Schema.Types.ObjectId, ref: 'BotFlow', required: true, index: true },
    assetKey: { type: String, required: true, trim: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, default: 'image/png' },
    fileSize: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },
    status: { type: String, enum: ['used', 'unused'], default: 'unused' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, strict: true }
);

// Ensure assetKey is unique within the same bot flow
botMediaAssetSchema.index({ botId: 1, assetKey: 1 }, { unique: true });

module.exports = mongoose.model('BotMediaAsset', botMediaAssetSchema);
