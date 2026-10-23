const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    openingBalance: {
      type: Number,
      required: true,
      default: 0
    },
    closingBalance: {
      type: Number,
      required: true,
      default: 0
    },
    category: {
      type: String,
      enum: [
        'topup_razorpay',
        'topup_upi_qr',
        'topup_manual',
        'meta_marketing',
        'meta_utility',
        'meta_authentication',
        'meta_service',
        'campaign_broadcast',
        'bot_reply',
        'direct_message',
        'refund',
        'adjustment'
      ],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['success', 'pending', 'failed', 'rejected'],
      default: 'success',
      index: true
    },
    description: {
      type: String,
      default: ''
    },
    paymentDetails: {
      razorpayOrderId: { type: String, default: '' },
      razorpayPaymentId: { type: String, default: '' },
      razorpaySignature: { type: String, default: '' },
      utrNumber: { type: String, default: '' },
      screenshot: { type: String, default: '' },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      verifiedAt: { type: Date },
      rejectionReason: { type: String, default: '' },
      invoiceNumber: { type: String, default: '' }
    },
    metaData: {
      recipientPhone: { type: String, default: '' },
      campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
      campaignName: { type: String, default: '' },
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
      metaMessageId: { type: String, default: '' },
      conversationId: { type: String, default: '' },
      conversationCategory: { type: String, default: '' }
    }
  },
  { timestamps: true }
);

walletTransactionSchema.index({ organizationId: 1, createdAt: -1 });
walletTransactionSchema.index({ organizationId: 1, type: 1, createdAt: -1 });
walletTransactionSchema.index({ 'metaData.metaMessageId': 1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
