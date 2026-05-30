const mongoose = require('mongoose');

const replyTriggerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    triggerText: { type: String, trim: true, default: '' }, // Keyword trigger (empty if fallback)
    templateIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Template' }], // Target templates to auto-reply with
    customTemplateId: { type: String }, // support local custom templates or custom reply text
    replyText: { type: String, default: '' }, // simple direct text reply option
    isFallback: { type: Boolean, default: false }, // Default responder when no other trigger matches
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

replyTriggerSchema.index({ userId: 1, isFallback: 1 });
replyTriggerSchema.index({ userId: 1, triggerText: 1 });

module.exports = mongoose.model('ReplyTrigger', replyTriggerSchema);
