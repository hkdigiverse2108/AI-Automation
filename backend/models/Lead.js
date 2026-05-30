const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    name: { type: String, trim: true, default: '' },
    companyName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    serviceRequired: { type: String, trim: true, default: '' },
    projectDescription: { type: String, trim: true, default: '' },
    budget: { type: String, trim: true, default: '' },
    numericBudget: { type: Number, default: 0 },
    timeline: { type: String, trim: true, default: '' },
    preferredTechnology: { type: String, trim: true, default: '' },
    specialRequirements: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['new', 'qualified', 'proposal_sent', 'closed'],
      default: 'new'
    },
    notes: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    conversationDateTime: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

leadSchema.index({ userId: 1, status: 1 });
leadSchema.index({ userId: 1, contactId: 1 }, { unique: true });
leadSchema.index({ userId: 1, name: 1 });
leadSchema.index({ userId: 1, conversationDateTime: -1 });

module.exports = mongoose.model('Lead', leadSchema);
