const mongoose = require('mongoose');

const teamChatMemberSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamChat',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    isMarkedUnread: {
      type: Boolean,
      default: false
    },
    lastReadAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: false }
);

// Ensure a user can only be in a chat once
teamChatMemberSchema.index({ chatId: 1, userId: 1 }, { unique: true });
teamChatMemberSchema.index({ userId: 1 });

module.exports = mongoose.model('TeamChatMember', teamChatMemberSchema);
