const mongoose = require('mongoose');

const contactGroupSchema = new mongoose.Schema(
  {
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, strict: true }
);

// Enforce unique mapping per contact per group
contactGroupSchema.index({ contactId: 1, groupId: 1 }, { unique: true });
contactGroupSchema.index({ groupId: 1 });
contactGroupSchema.index({ organizationId: 1 });

module.exports = mongoose.model('ContactGroup', contactGroupSchema);
