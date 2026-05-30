const mongoose = require('mongoose');

const autoTagRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ruleName: { type: String, required: true, trim: true },
    triggerType: { type: String, enum: ['keyword', 'source'], required: true },
    triggerValue: { type: String, required: true, trim: true },
    tagToAssign: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

autoTagRuleSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('AutoTagRule', autoTagRuleSchema);
