const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      default: ''
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'overdue', 'cancelled'],
      default: 'pending',
      index: true
    },
    dueDate: {
      type: Date,
      required: true,
      index: true
    },
    dueTime: {
      type: String,
      default: ''
    },
    completedAt: {
      type: Date
    },
    remindedHourBefore: {
      type: Boolean,
      default: false
    },
    remindedOnDue: {
      type: Boolean,
      default: false
    },
    remindedOverdue: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true, strict: true }
);

// Compound indexes for pagination and filtering efficiency
taskSchema.index({ organizationId: 1, isDeleted: 1, status: 1 });
taskSchema.index({ organizationId: 1, isDeleted: 1, assignedTo: 1 });
taskSchema.index({ organizationId: 1, isDeleted: 1, assignedBy: 1 });
taskSchema.index({ organizationId: 1, isDeleted: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
