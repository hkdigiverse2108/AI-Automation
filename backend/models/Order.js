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
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
      enum: ['created', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'created',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'created_by'
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, strict: true }
);

// Compound indexes for listings
orderSchema.index({ organizationId: 1, status: 1 });
orderSchema.index({ contactId: 1 });

module.exports = mongoose.model('Order', orderSchema);
