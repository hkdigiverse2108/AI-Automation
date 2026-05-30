const mongoose = require('mongoose');

const whatsAppAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phoneNumber: { type: String, required: true },
    phoneNumberId: { type: String, required: true },
    accessToken: { type: String, required: true }, // stored encrypted via AES-256-GCM
    wabaId: { type: String, required: true },
    displayName: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    webhookVerified: { type: Boolean, default: false },
    qualityRating: { type: String, default: 'GREEN' },
    messagingLimit: { type: String, default: 'TIER_1' },
  },
  { timestamps: true, strict: true }
);

whatsAppAccountSchema.index({ userId: 1 });
whatsAppAccountSchema.index({ phoneNumberId: 1 }, { unique: true });

module.exports = mongoose.model('WhatsAppAccount', whatsAppAccountSchema);
