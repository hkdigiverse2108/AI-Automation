const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'checked_out'],
      default: 'active',
      index: true
    }
  },
  { timestamps: true, strict: true }
);

// Prevent multiple active carts for the same customer (contact)
cartSchema.index(
  { customerId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

module.exports = mongoose.model('Cart', cartSchema);
