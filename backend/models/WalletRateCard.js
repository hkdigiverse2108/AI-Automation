const mongoose = require('mongoose');

const walletRateCardSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    marketing: {
      type: Number,
      default: 0.85 // approx ₹0.82 Meta base + ₹0.03 platform
    },
    utility: {
      type: Number,
      default: 0.15
    },
    authentication: {
      type: Number,
      default: 0.15
    },
    service: {
      type: Number,
      default: 0.35
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WalletRateCard', walletRateCardSchema);
