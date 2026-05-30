const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phone: { type: String, required: true, trim: true },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    profilePic: { type: String, default: '' },
    source: {
      type: String,
      enum: ['instagram', 'facebook', 'website', 'manual', 'import', 'api', 'direct'],
      default: 'manual',
    },
    tags: [{ type: String, trim: true }],
    customFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    optedOut: { type: Boolean, default: false },
    optedOutAt: { type: Date },
    lastMessageAt: { type: Date },
    totalMessages: { type: Number, default: 0 },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, strict: true }
);

contactSchema.pre('save', function (next) {
  if (this.isModified('phone') && this.phone) {
    this.phone = this.phone.replace(/\D/g, '');
  }
  next();
});

contactSchema.index({ userId: 1, phone: 1 }, { unique: true });
contactSchema.index({ userId: 1, tags: 1 });
contactSchema.index({ userId: 1, source: 1 });
contactSchema.index({ userId: 1, lastMessageAt: -1 });
contactSchema.index({ userId: 1, isDeleted: 1 });
contactSchema.index({ userId: 1, name: 1 });
contactSchema.index({ userId: 1, email: 1 });

module.exports = mongoose.model('Contact', contactSchema);
