const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      index: true,
      alias: 'organization_id'
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Business meeting with HK DigiVerse LLP'
    },
    description: {
      type: String,
      default: ''
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: false,
      index: true,
      alias: 'contact_id'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
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
      default: 'confirmed',
      index: true
    },
    reminderTime: {
      type: Number, // reminder window in minutes before scheduledAt (120 mins = 2 hours)
      default: 120,
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
      required: false,
      alias: 'created_by'
    },
    // Google Calendar Integration Fields
    googleEventId: {
      type: String,
      sparse: true,
      index: true
    },
    googleCalendarId: {
      type: String,
      default: 'hrmangukiya3494@gmail.com'
    },
    bookingUrl: {
      type: String,
      default: 'https://calendar.app.google/ZvhrmRV1dnYSL4XC8'
    },
    clientName: {
      type: String,
      default: ''
    },
    clientPhone: {
      type: String,
      default: ''
    },
    clientEmail: {
      type: String,
      default: ''
    },
    meetingLink: {
      type: String,
      default: ''
    },
    cancellationReason: {
      type: String,
      default: ''
    },
    notifications: {
      confirmed: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String },
        error: { type: String }
      },
      reminder: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String },
        error: { type: String }
      },
      rescheduled: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String },
        error: { type: String }
      },
      cancelled: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String },
        error: { type: String }
      },
      thankYou: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String },
        error: { type: String }
      }
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, strict: true }
);

// Compound indexes for dashboard listings
appointmentSchema.index({ organizationId: 1, status: 1, scheduledAt: 1 });
appointmentSchema.index({ assignedTo: 1, scheduledAt: 1 });
appointmentSchema.index({ googleEventId: 1 });
appointmentSchema.index({ clientPhone: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
