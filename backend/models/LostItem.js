const mongoose = require('mongoose');

const lostItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: 'Anonymous' },
    phone_number: { type: String, required: true, trim: true },
    lost_item: { type: String, required: true, default: '' },
    date_lost: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['reported', 'found'],
      default: 'reported',
      index: true
    },
    recording_url: { type: String, default: '' },
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true }
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('LostItem', lostItemSchema);
