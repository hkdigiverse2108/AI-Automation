const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    planMonths: { type: Number, required: true, enum: [1, 3, 6, 12] },
    amount: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'expiring_soon', 'expired', 'pending'],
      default: 'pending',
      index: true
    },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }
  },
  { timestamps: true }
);

subscriptionSchema.index({ organizationId: 1, status: 1 });
subscriptionSchema.index({ expiryDate: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
