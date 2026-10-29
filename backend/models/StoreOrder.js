const mongoose = require('mongoose');

const storeOrderSchema = new mongoose.Schema(
  {
    store: { type: String, default: 'luscentglow', index: true },
    orderId: { type: String, required: true, index: true },
    customerName: { type: String, default: 'Valued Customer' },
    customerPhone: { type: String, required: true, index: true },
    customerEmail: { type: String, default: '' },
    shippingAddress: { type: String, default: '' },
    items: [
      {
        name: { type: String, default: '' },
        quantity: { type: Number, default: 1 },
        price: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
      },
    ],
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, default: 'Online' }, // Online, COD, Razorpay, Cashfree
    paymentStatus: { type: String, default: 'PENDING' }, // PAID, PENDING, FAILED
    transactionId: { type: String, default: '' },
    invoiceUrl: { type: String, default: '' },

    // Logistics & Tracking
    courierPartner: { type: String, default: 'Delhivery' },
    waybill: { type: String, default: '', index: true },
    trackingStatus: { type: String, default: 'PLACED' }, // PLACED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
    trackingHistory: [
      {
        status: { type: String },
        location: { type: String },
        timestamp: { type: Date, default: Date.now },
        details: { type: String },
      },
    ],

    // WhatsApp Notification Tracking
    notifications: {
      orderConfirmed: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        messageId: String,
        error: String,
      },
      paymentReceived: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        messageId: String,
        error: String,
      },
      shippingStarted: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        messageId: String,
        error: String,
      },
      outForDelivery: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        messageId: String,
        error: String,
      },
      orderDelivered: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        messageId: String,
        error: String,
      },
    },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

storeOrderSchema.index({ store: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.model('StoreOrder', storeOrderSchema);

