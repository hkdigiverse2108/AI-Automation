const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    discountPrice: {
      type: Number,
      default: null,
      min: 0
    },
    sku: {
      type: String,
      trim: true,
      default: ''
    },
    barcode: {
      type: String,
      trim: true,
      default: ''
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0
    },
    status: {
      type: String,
      enum: ['in_stock', 'low_stock', 'out_of_stock'],
      default: 'in_stock',
      index: true
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true, strict: true }
);

// Auto-recalculate availability status on save
productSchema.pre('save', function (next) {
  if (this.isModified('quantity') || this.isModified('lowStockThreshold')) {
    if (this.quantity === 0) {
      this.status = 'out_of_stock';
    } else if (this.quantity <= this.lowStockThreshold) {
      this.status = 'low_stock';
    } else {
      this.status = 'in_stock';
    }
  }
  next();
});

// Indexing for search, filtering, and organization isolation
productSchema.index({ organizationId: 1, name: 1 }, { unique: true });
productSchema.index({ organizationId: 1, categoryId: 1 });
productSchema.index({ organizationId: 1, sku: 1 });
productSchema.index({ organizationId: 1, isArchived: 1 });

module.exports = mongoose.model('Product', productSchema);
