const mongoose = require('mongoose');

const invoiceSettingsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    companyName: { type: String, default: '' },
    tagline: { type: String, default: '' },
    logo: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'India' },
    pincode: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    website: { type: String, default: '' },
    gstin: { type: String, default: '' },
    pan: { type: String, default: '' },
    // Bank Details
    bankName: { type: String, default: '' },
    accountHolder: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    branch: { type: String, default: '' },
    upiId: { type: String, default: '' },
    upiQrCode: { type: String, default: '' },
    // Other Bank Accounts (for Proforma / Alternate accounts)
    otherAccounts: {
      type: Array,
      default: []
    },
    // Defaults for Invoices
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' },
    invoicePrefix: { type: String, default: 'INV-' },
    nextInvoiceNumber: { type: Number, default: 1001 },
    defaultDueDays: { type: Number, default: 15 },
    defaultInvoiceType: { type: String, default: 'tax_invoice' },
    defaultNotes: { type: String, default: 'Thank you for your business!' },
    defaultTerms: { type: String, default: 'Payment is due within 15 days of invoice date.' }
  },
  { timestamps: true }
);

invoiceSettingsSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('InvoiceSettings', invoiceSettingsSchema);
