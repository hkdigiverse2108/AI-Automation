const mongoose = require('mongoose');

const sequenceExecutionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sequenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sequence', required: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
    status: { type: String, enum: ['running', 'completed', 'cancelled'], default: 'running' },
    nextStepIndex: { type: Number, default: 0 },
    scheduledAt: { type: Date, required: true },
    logs: [
      {
        stepIndex: { type: Number },
        templateName: { type: String },
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
        status: { type: String, enum: ['sent', 'failed'] },
        error: { type: String },
        sentAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, strict: true }
);

sequenceExecutionSchema.index({ userId: 1, status: 1, scheduledAt: 1 });
sequenceExecutionSchema.index({ userId: 1, contactId: 1, sequenceId: 1 });

module.exports = mongoose.model('SequenceExecution', sequenceExecutionSchema);
