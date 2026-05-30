const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    templateId: { type: String },
    templateName: { type: String },
    audience: {
      type: { type: String, enum: ['all', 'tag', 'segment', 'upload'], default: 'all' },
      tags: [String],
      contactIds: [{ type: mongoose.Schema.Types.ObjectId }],
      totalCount: { type: Number, default: 0 },
    },
    variables: [{ type: String }],
    headerMediaId: { type: String },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'running', 'paused', 'completed', 'failed'],
      default: 'draft',
    },
    stats: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
      replied: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      optedOut: { type: Number, default: 0 },
    },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    jobId: { type: String },
  },
  { timestamps: true, strict: true }
);

campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ userId: 1, scheduledAt: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);
