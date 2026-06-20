const mongoose = require('mongoose');

const contactTagSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
    },
    tagId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tag',
      required: true,
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, strict: true }
);

// Indexes for query performance and preventing duplicate tagging
contactTagSchema.index({ organizationId: 1 });
contactTagSchema.index({ contactId: 1 });
contactTagSchema.index({ tagId: 1 });
contactTagSchema.index({ contactId: 1, tagId: 1 }, { unique: true });

module.exports = mongoose.model('ContactTag', contactTagSchema);
