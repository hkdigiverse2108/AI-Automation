const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: 'Anonymous' },
    phone_number: { type: String, required: true, trim: true },
    visit_date: { type: Date, default: Date.now },
    complaint: { type: String, required: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved'],
      default: 'pending',
      index: true
    },
    recording_url: { type: String, default: '' },
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true }
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);
