const mongoose = require('mongoose');

const orderStatusHistorySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
      alias: 'order_id'
    },
    status: {
      type: String,
      required: true,
      index: true
    },
    notes: {
      type: String,
      trim: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      alias: 'changed_by'
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, strict: true }
);

module.exports = mongoose.model('OrderStatusHistory', orderStatusHistorySchema);
