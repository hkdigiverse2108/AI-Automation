const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, strict: true }
);

// Prevent duplicate group names under the same organization
groupSchema.index({ organizationId: 1, name: 1 }, { unique: true });
groupSchema.index({ organizationId: 1 });

module.exports = mongoose.model('Group', groupSchema);
