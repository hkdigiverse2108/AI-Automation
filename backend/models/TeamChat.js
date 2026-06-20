const mongoose = require('mongoose');

const teamChatSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    type: {
      type: String,
      enum: ['private', 'group'],
      required: true,
      default: 'private'
    },
    name: {
      type: String,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

teamChatSchema.index({ organizationId: 1 });
teamChatSchema.index({ type: 1 });

module.exports = mongoose.model('TeamChat', teamChatSchema);
