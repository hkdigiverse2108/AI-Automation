const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
      alias: 'order_id'
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
      alias: 'product_id'
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      alias: 'unit_price'
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
      alias: 'total_price'
    }
  },
  { timestamps: true, strict: true }
);

// Prevent duplicate product entries in the same order
orderItemSchema.index({ orderId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('OrderItem', orderItemSchema);
