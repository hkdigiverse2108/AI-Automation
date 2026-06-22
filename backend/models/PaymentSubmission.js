const mongoose = require('mongoose');

const paymentSubmissionSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
      alias: 'order_id'
    },
    utrNumber: {
      type: String,
      trim: true,
      index: true,
      alias: 'utr_number'
    },
    screenshotUrl: {
      type: String,
      trim: true,
      alias: 'screenshot_url'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      alias: 'verified_by'
    },
    verifiedAt: {
      type: Date,
      alias: 'verified_at'
    },
    rejectionReason: {
      type: String,
      trim: true,
      alias: 'rejection_reason'
    }
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('PaymentSubmission', paymentSubmissionSchema);
