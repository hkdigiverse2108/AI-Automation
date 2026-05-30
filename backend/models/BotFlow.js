const mongoose = require('mongoose');

const edgeSchema = new mongoose.Schema(
  {
    targetNodeId: { type: String, required: true },
    label: { type: String, default: '' },
    condition: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['message', 'question', 'condition', 'action', 'delay', 'ai', 'handoff'],
      required: true,
    },
    position: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
    data: {
      message: { type: mongoose.Schema.Types.Mixed },
      variable: { type: String },
      condition: { type: mongoose.Schema.Types.Mixed },
      action: { type: mongoose.Schema.Types.Mixed },
      delaySeconds: { type: Number },
      aiPrompt: { type: String },
    },
    edges: [edgeSchema],
  },
  { _id: false }
);

const botFlowSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    trigger: {
      type: { type: String, enum: ['keyword', 'any', 'campaign', 'source'], default: 'keyword' },
      keywords: [{ type: String, lowercase: true, trim: true }],
      source: { type: String },
    },
    nodes: [nodeSchema],
    entryNodeId: { type: String },
    isActive: { type: Boolean, default: false },
    totalSessions: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
  },
  { timestamps: true, strict: true }
);

botFlowSchema.index({ userId: 1, isActive: 1 });
botFlowSchema.index({ userId: 1, 'trigger.keywords': 1 });

module.exports = mongoose.model('BotFlow', botFlowSchema);
