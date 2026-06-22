const mongoose = require('mongoose');

const callbackRequestSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: 'Anonymous' },
    phone_number: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
      index: true
    },
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true }
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('CallbackRequest', callbackRequestSchema);
