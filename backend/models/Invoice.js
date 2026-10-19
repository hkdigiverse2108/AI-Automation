const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  hsnSac: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  discountPerUnit: { type: Number, default: 0 },
  totalDiscount: { type: Number, default: 0 },
  amount: { type: Number, default: 0 }
});

const invoiceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    invoiceNumber: { type: String, required: true },
    invoiceType: {
      type: String,
      enum: ['tax_invoice', 'proforma_invoice'],
      default: 'tax_invoice'
    },
    paymentMode: {
      type: String,
      default: 'current_account'
    },
    selectedOtherAccountId: { type: String, default: '' },
    invoiceDate: { type: Date, default: Date.now },
    dueDays: { type: Number, default: 15 },
    dueDate: { type: Date },
    // Customer Details
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    customerCity: { type: String, default: '' },
    customerState: { type: String, default: '' },
    customerAddress: { type: String, default: '' },
    customerGstin: { type: String, default: '' },
    companyState: { type: String, default: '' },
    // Items
    items: [invoiceItemSchema],
    // Pricing
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }, // Overall discount
    totalItemDiscount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    gstType: {
      type: String,
      enum: ['intra_state', 'inter_state', 'no_tax'],
      default: 'intra_state'
    },
    taxOption: {
      type: String,
      default: 'cgst_sgst'
    },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    cgstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstRate: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    unroundedTotal: { type: Number, default: 0 },
    roundOffAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    amountInWords: { type: String, default: '' },
    // Status
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'payment_due', 'cancelled'],
      default: 'draft'
    },
    notes: { type: String, default: '' },
    terms: { type: String, default: '' },
    // Snapshots of company and bank details at the time of creation
    companySnapshot: { type: Object, default: {} },
    bankSnapshot: { type: Object, default: {} },
  },
  { timestamps: true }
);

invoiceSchema.index({ userId: 1, invoiceNumber: 1 });
invoiceSchema.index({ userId: 1, customerId: 1 });
invoiceSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
