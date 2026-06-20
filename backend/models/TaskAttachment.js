const mongoose = require('mongoose');

const taskAttachmentSchema = new mongoose.Schema(
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
    fileUrl: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      default: 'attachment'
    }
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('TaskAttachment', taskAttachmentSchema);
