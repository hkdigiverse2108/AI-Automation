const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'document', 'interactive', 'template', 'reaction', 'sticker', 'location'],
      default: 'text',
    },
    content: {
      text: { type: String, default: '' },
      mediaUrl: { type: String },
      mediaId: { type: String },
      caption: { type: String },
      filename: { type: String },
      interactive: { type: mongoose.Schema.Types.Mixed },
      template: { type: mongoose.Schema.Types.Mixed },
      reaction: { type: String },
      location: { latitude: Number, longitude: Number, name: String, address: String },
      referral: { type: mongoose.Schema.Types.Mixed },
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending',
    },
    metaMessageId: { type: String },
    sentBy: { type: String, enum: ['bot', 'human', 'ai', 'system'], default: 'system' },
    campaignId: { type: mongoose.Schema.Types.ObjectId },
    errorDetails: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: true }
);

messageSchema.index({ userId: 1, conversationId: 1, timestamp: -1 });
messageSchema.index({ userId: 1, contactId: 1 });
messageSchema.index({ metaMessageId: 1 }, { sparse: true });
messageSchema.index({ userId: 1, campaignId: 1 }, { sparse: true });
messageSchema.index({ userId: 1, timestamp: -1 });
messageSchema.index({ userId: 1, direction: 1, timestamp: -1 });
messageSchema.index({ userId: 1, direction: 1, status: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
