const mongoose = require('mongoose');

const assignmentRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ruleName: { type: String, required: true, trim: true },
    triggerType: { type: String, enum: ['keyword', 'source', 'all'], default: 'all' },
    triggerValue: { type: String, trim: true, default: '' },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

assignmentRuleSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('AssignmentRule', assignmentRuleSchema);
