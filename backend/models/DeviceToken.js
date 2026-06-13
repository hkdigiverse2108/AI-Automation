const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    token: { type: String, required: true, trim: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: true }
);

deviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
deviceTokenSchema.index({ token: 1 });
deviceTokenSchema.index({ organizationId: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
