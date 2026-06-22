const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema(
  {
    // Legacy fields for mobile app synchronization
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    phone: { type: String, trim: true, required: false },
    name: { type: String, trim: true, default: '' },
    timestamp: { type: Date, default: Date.now },
    callType: {
      type: String,
      enum: ['incoming', 'outgoing', 'missed', 'rejected', 'unknown'],
      default: 'unknown',
    },

    // IVR Telephony fields (MyOperator Integration)
    session_id: { type: String, unique: true, sparse: true, trim: true },
    from_number: { type: String, trim: true },
    to_number: { type: String, trim: true },
    duration: { type: Number, default: 0 }, // duration in seconds
    status: { type: String, trim: true, default: 'initiated' },
    last_intent: { type: String, trim: true, default: '' },
    recording_url: { type: String, trim: true, default: '' },
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true }
  },
  { timestamps: true, strict: true }
);

callLogSchema.index({ userId: 1, timestamp: -1 });
callLogSchema.index({ userId: 1, phone: 1 });

module.exports = mongoose.model('CallLog', callLogSchema);
