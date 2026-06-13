const mongoose = require('mongoose');

const deviceContactSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    name: { type: String, trim: true, default: '' },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    syncTimestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: true }
);

deviceContactSchema.index({ userId: 1, phone: 1 }, { unique: true });
deviceContactSchema.index({ userId: 1, name: 1 });
deviceContactSchema.index({ organizationId: 1 });

module.exports = mongoose.model('DeviceContact', deviceContactSchema);
