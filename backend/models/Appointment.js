const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
      alias: 'organization_id'
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true,
      alias: 'contact_id'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      alias: 'assigned_to'
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
      alias: 'scheduled_at'
    },
    duration: {
      type: Number, // duration in minutes
      default: 30
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true
    },
    reminderTime: {
      type: Number, // reminder window in minutes before scheduledAt
      default: 15,
      alias: 'reminder_time'
    },
    reminded: {
      type: Boolean,
      default: false,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'created_by'
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, strict: true }
);

// Compound indexes for dashboard listings
appointmentSchema.index({ organizationId: 1, status: 1, scheduledAt: 1 });
appointmentSchema.index({ assignedTo: 1, scheduledAt: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
