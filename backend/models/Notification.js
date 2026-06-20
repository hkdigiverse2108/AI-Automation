const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, alias: 'user_id' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true, alias: 'organization_id' },
  type: {
    type: String,
    enum: ['system', 'campaign', 'contact', 'bot', 'team', 'message', 'subscription', 'appointment', 'order'],
    default: 'system'
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: '' },
  icon: { type: String, default: '' },
  isRead: { type: Boolean, default: false, index: true, alias: 'is_read' },
  referenceType: { type: String, default: '', alias: 'reference_type' },
  referenceId: { type: String, default: '', alias: 'reference_id' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Auto-delete notifications after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
notificationSchema.index({ createdAt: -1 });

// Compound index for efficient queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ organization: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
