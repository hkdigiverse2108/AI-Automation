const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    imageUrl: {
      type: String,
      required: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, strict: true }
);

module.exports = mongoose.model('ProductImage', productImageSchema);
