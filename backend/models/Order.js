const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
      alias: 'organization_id'
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      alias: 'order_number'
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true,
      alias: 'contact_id'
    },
    customerName: {
      type: String,
      trim: true,
      alias: 'customer_name'
    },
    phoneNumber: {
      type: String,
      trim: true,
      alias: 'phone_number'
    },
    address: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      alias: 'assigned_to'
    },
    totalAmount: {
      type: Number,
      required: true,
      alias: 'total_amount'
    },
    status: {
      type: String,
      enum: [
        'Pending Payment',
        'Payment Submitted',
        'Payment Verified',
        'Confirmed',
        'Processing',
        'Shipped',
        'Delivered',
        'Cancelled'
      ],
      default: 'Pending Payment',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      alias: 'created_by'
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, strict: true }
);

// Compound indexes for listings and isolation
orderSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
