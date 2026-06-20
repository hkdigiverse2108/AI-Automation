const mongoose = require('mongoose');

const teamChatMessageSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamChat',
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'document', 'pdf', 'audio', 'video', 'emoji'],
      default: 'text',
      required: true
    },
    message: {
      type: String,
      trim: true
    },
    fileUrl: {
      type: String
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    readReceipts: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        status: {
          type: String,
          enum: ['sent', 'delivered', 'read'],
          default: 'sent'
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

teamChatMessageSchema.index({ chatId: 1, createdAt: -1 });
teamChatMessageSchema.index({ organizationId: 1 });
teamChatMessageSchema.index({ senderId: 1 });

module.exports = mongoose.model('TeamChatMessage', teamChatMessageSchema);
