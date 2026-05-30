const mongoose = require('mongoose');

const apiLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['webhook_incoming', 'api_call', 'button_response'], required: true },
    method: { type: String, default: '' },
    url: { type: String, default: '' },
    requestBody: { type: mongoose.Schema.Types.Mixed },
    responseBody: { type: mongoose.Schema.Types.Mixed },
    statusCode: { type: Number },
    ip: { type: String, default: '' },
    details: { type: String, default: '' }, // For logging specific messages or events (e.g. click logs)
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: true }
);

apiLogSchema.index({ userId: 1, type: 1, timestamp: -1 });
apiLogSchema.index({ timestamp: -1 });
apiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('ApiLog', apiLogSchema);

