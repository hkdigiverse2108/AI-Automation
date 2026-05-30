const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
    status: {
      type: String,
      enum: ['bot', 'human', 'ai', 'resolved', 'waiting'],
      default: 'bot',
    },
    currentFlowId: { type: mongoose.Schema.Types.ObjectId, ref: 'BotFlow' },
    currentNodeId: { type: String },
    flowVariables: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assigned_agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assigned_at: { type: Date },
    lock_status: { type: Boolean, default: false },
    takeover_status: { type: String, enum: ['ai', 'human'], default: 'ai' },
    source: { type: String, default: 'direct' },
    campaignId: { type: mongoose.Schema.Types.ObjectId },
    lastMessageAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    tags: [{ type: String }],
    isRead: { type: Boolean, default: false },
    unreadCount: { type: Number, default: 0 },
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ai_enabled: { type: Boolean, default: true },
    current_owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    last_activity: { type: Date, default: Date.now }
  },
  { timestamps: true, strict: true }
);

conversationSchema.index({ organization_id: 1, lastMessageAt: -1 });

conversationSchema.index({ userId: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1, contactId: 1 }, { unique: true });
conversationSchema.index({ userId: 1, assignedAgent: 1 });
conversationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
