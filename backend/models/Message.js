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
    isEncrypted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
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

messageSchema.pre('save', async function (next) {
  try {
    const { getOekForUser, encryptMessage } = require('../services/oekService');
    const rawOek = await getOekForUser(this.userId);
    if (rawOek) {
      const encrypted = encryptMessage({
        content: this.content
      }, rawOek);
      this.content = encrypted.content;
      this.isEncrypted = true;
    }
  } catch (err) {
    console.error('Message encryption pre-save failed:', err.message);
  }
  next();
});

messageSchema.post('find', async function (docs) {
  if (!docs || !Array.isArray(docs)) return;
  try {
    const { getOekForUser, decryptMessage } = require('../services/oekService');
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (doc.isEncrypted) {
        const rawOek = await getOekForUser(doc.userId);
        if (rawOek) {
          const decrypted = decryptMessage(doc, rawOek);
          Object.assign(doc, decrypted);
        }
      }
    }
  } catch (err) {
    console.error('Message decryption post-find failed:', err.message);
  }
});

messageSchema.post('findOne', async function (doc) {
  if (!doc) return;
  try {
    const { getOekForUser, decryptMessage } = require('../services/oekService');
    if (doc.isEncrypted) {
      const rawOek = await getOekForUser(doc.userId);
      if (rawOek) {
        const decrypted = decryptMessage(doc, rawOek);
        if (doc.toObject) {
          doc.content = decrypted.content;
        } else {
          Object.assign(doc, decrypted);
        }
      }
    }
  } catch (err) {
    console.error('Message decryption post-findOne failed:', err.message);
  }
});

messageSchema.post('save', async function (doc) {
  if (!doc) return;
  try {
    const { getOekForUser, decryptMessage } = require('../services/oekService');
    if (doc.isEncrypted) {
      const rawOek = await getOekForUser(doc.userId);
      if (rawOek) {
        const decrypted = decryptMessage(doc, rawOek);
        doc.content = decrypted.content;
      }
    }
    if (doc.contactId) {
      const { calculateContactScore } = require('../services/scoring');
      calculateContactScore(doc.contactId).catch(err => {
        console.error('Error auto-calculating contact score on message save:', err.message);
      });
    }
  } catch (err) {
    console.error('Message decryption post-save failed:', err.message);
  }
});

module.exports = mongoose.model('Message', messageSchema);
