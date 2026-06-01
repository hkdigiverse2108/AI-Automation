const mongoose = require('mongoose');

const botMediaUsageSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'BotMediaAsset', required: true, index: true },
    botId: { type: mongoose.Schema.Types.ObjectId, ref: 'BotFlow', required: true, index: true },
    nodeId: { type: String, required: true },
  },
  { timestamps: true, strict: true }
);

botMediaUsageSchema.index({ botId: 1, nodeId: 1 });

module.exports = mongoose.model('BotMediaUsage', botMediaUsageSchema);
