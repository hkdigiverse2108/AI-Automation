const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    monthlyPrice: { type: Number, required: true, default: 2000 },
    currency: { type: String, default: 'INR' },
    taxPercentage: { type: Number, default: 0 },
    gracePeriodDays: { type: Number, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

/**
 * Get or create the singleton plan config document.
 */
subscriptionPlanSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({ monthlyPrice: 2000, currency: 'INR', taxPercentage: 0, gracePeriodDays: 0 });
  }
  return config;
};

/**
 * Calculate pricing for a given number of months.
 */
subscriptionPlanSchema.methods.calculatePrice = function (months) {
  const baseAmount = this.monthlyPrice * months;
  const taxAmount = Math.round((baseAmount * this.taxPercentage) / 100);
  const totalAmount = baseAmount + taxAmount;
  return { baseAmount, taxAmount, totalAmount };
};

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
