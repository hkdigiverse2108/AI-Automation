const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    phone: { type: String, required: true, trim: true },
    name: { type: String, trim: true, default: '' },
    duration: { type: Number, default: 0 }, // duration in seconds
    timestamp: { type: Date, default: Date.now },
    callType: {
      type: String,
      enum: ['incoming', 'outgoing', 'missed', 'rejected', 'unknown'],
      default: 'unknown',
    },
  },
  { timestamps: true, strict: true }
);

callLogSchema.index({ userId: 1, timestamp: -1 });
callLogSchema.index({ userId: 1, phone: 1 });
callLogSchema.index({ organizationId: 1 });

module.exports = mongoose.model('CallLog', callLogSchema);
