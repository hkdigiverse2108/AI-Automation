const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    followUpType: {
      type: String,
      enum: ['whatsapp', 'call', 'email', 'manual'],
      required: true,
    },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending',
    },
    completedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, strict: true }
);

// Indexes optimized for filtering and scheduler scans
followUpSchema.index({ organizationId: 1, status: 1, scheduledAt: 1 });
followUpSchema.index({ contactId: 1 });
followUpSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('FollowUp', followUpSchema);
