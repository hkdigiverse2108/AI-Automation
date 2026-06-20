const mongoose = require('mongoose');

const taskCommentSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    comment: {
      type: String,
      required: true,
      trim: true
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskComment',
      default: null,
      index: true
    }
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('TaskComment', taskCommentSchema);
