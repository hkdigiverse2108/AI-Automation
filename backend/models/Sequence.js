const mongoose = require('mongoose');

const sequenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    triggerTag: { type: String, trim: true, default: '' }, // Auto-trigger sequence when contact is tagged with this
    messages: [
      {
        delayValue: { type: Number, required: true, default: 1 },
        delayUnit: { type: String, enum: ['minutes', 'hours', 'days'], default: 'days' },
        templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
        templateName: { type: String, required: true },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

sequenceSchema.index({ userId: 1 });
sequenceSchema.index({ userId: 1, triggerTag: 1 });

module.exports = mongoose.model('Sequence', sequenceSchema);
