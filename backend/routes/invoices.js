const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const InvoiceSettings = require('../models/InvoiceSettings');
const Invoice = require('../models/Invoice');
const Contact = require('../models/Contact');
const Organization = require('../models/Organization');
const { verifyToken } = require('../middleware/auth');
const { getOekForUser, decryptContact } = require('../services/oekService');

// Multer storage for company logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const uniqueSuffix = 'logo-' + req.userId + '-' + Date.now() + ext;
    cb(null, uniqueSuffix);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, WebP, SVG) are allowed for company logo'));
    }
  }
});

router.use(verifyToken);

// POST /api/invoices/upload-logo - Direct image upload for company logo
router.post('/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    
    await InvoiceSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: { logo: fileUrl } },
      { upsert: true }
    );

    res.json({ success: true, url: fileUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to upload logo', details: error.message });
  }
});

// GET /api/invoices/settings - Get company branding & bank details
router.get('/settings', async (req, res) => {
  try {
    let settings = await InvoiceSettings.findOne({ userId: req.userId }).lean();
    
    // If not configured yet, fallback to Organization details
    if (!settings) {
      let org = null;
      if (req.user?.organizationId) {
        org = await Organization.findById(req.user.organizationId).lean();
      }
      
      settings = {
        companyName: org?.name || req.user?.name || '',
        tagline: '',
        logo: org?.logo || '',
        address: org?.address || '',
        city: org?.city || '',
        state: org?.state || '',
        country: org?.country || 'India',
        pincode: '',
        contactEmail: org?.contactEmail || req.user?.email || '',
        contactNumber: org?.contactNumber || '',
        website: org?.website || '',
        gstin: org?.gstNumber || '',
        pan: '',
        bankName: '',
        accountHolder: '',
        accountNumber: '',
        ifscCode: '',
        branch: '',
        upiId: '',
        upiQrCode: '',
        otherAccounts: [],
        currency: 'INR',
        currencySymbol: '₹',
        invoicePrefix: 'INV-',
        nextInvoiceNumber: 1001,
        defaultNotes: 'Thank you for choosing our services!',
        defaultTerms: '1. Payment is due within 15 days of the invoice date.\n2. Late payments may incur additional charges.\n3. All disputes are subject to Gujarat Jurisdiction.'
      };
    }

    res.json({ success: true, data: { settings } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch invoice settings', details: error.message });
  }
});

// PUT /api/invoices/settings - Update company branding & bank details
router.put('/settings', async (req, res) => {
  try {
    const payload = { ...req.body, userId: req.userId };
    if (req.user?.organizationId) {
      payload.organizationId = req.user.organizationId;
    }

    const settings = await InvoiceSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: { settings } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save invoice settings', details: error.message });
  }
});

// GET /api/invoices/customers - Get contacts / leads for dynamic customer dropdown
router.get('/customers', async (req, res) => {
  try {
    const contacts = await Contact.find({
      userId: req.userId,
      isDeleted: { $ne: true }
    })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(500)
      .lean();

    const rawOek = await getOekForUser(req.userId);
    const customers = contacts.map((c) => {
      const dec = decryptContact(c, rawOek);
      return {
        _id: dec._id,
        name: dec.name || 'Anonymous Client',
        phone: dec.phone || '',
        email: dec.email || '',
        city: dec.customFields?.city || '',
        state: dec.customFields?.state || '',
        address: dec.customFields?.address || dec.customFields?.city || '',
        gstin: dec.customFields?.gstin || dec.customFields?.gstNumber || '',
        serviceRequired: dec.customFields?.selectedService || dec.customFields?.service || '',
        budget: dec.customFields?.budget || '',
        timeline: dec.customFields?.timeline || '',
        status: dec.customFields?.status || 'new',
        segment: dec.segment || 'new'
      };
    });

    res.json({ success: true, data: { customers } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load customers list', details: error.message });
  }
});

// GET /api/invoices - List generated invoices
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: { invoices } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch invoices', details: error.message });
  }
});

// POST /api/invoices - Create new invoice
router.post('/', async (req, res) => {
  try {
    const {
      invoiceNumber,
      invoiceType = 'tax_invoice',
      paymentMode = 'current_account',
      selectedOtherAccountId = '',
      invoiceDate,
      dueDays = 15,
      dueDate,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerCity,
      customerState,
      customerAddress,
      customerGstin,
      companyState,
      items,
      subtotal,
      discount,
      totalItemDiscount,
      taxableAmount,
      gstType = 'intra_state',
      taxOption = 'cgst_sgst',
      taxPercent,
      taxAmount,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      unroundedTotal,
      roundOffAmount,
      grandTotal,
      amountInWords = '',
      status = 'sent',
      notes,
      terms,
      companySnapshot,
      bankSnapshot
    } = req.body;

    const invoice = await Invoice.create({
      userId: req.userId,
      organizationId: req.user?.organizationId,
      invoiceNumber,
      invoiceType,
      paymentMode,
      selectedOtherAccountId,
      invoiceDate: invoiceDate || new Date(),
      dueDays: Number(dueDays) || 15,
      dueDate,
      customerId: customerId || null,
      customerName,
      customerPhone,
      customerEmail,
      customerCity,
      customerState,
      customerAddress,
      customerGstin,
      companyState,
      items: items || [],
      subtotal: subtotal || 0,
      discount: discount || 0,
      totalItemDiscount: totalItemDiscount || 0,
      taxableAmount: taxableAmount || 0,
      gstType,
      taxOption,
      taxPercent: taxPercent || 0,
      taxAmount: taxAmount || 0,
      cgstRate: cgstRate || 0,
      cgstAmount: cgstAmount || 0,
      sgstRate: sgstRate || 0,
      sgstAmount: sgstAmount || 0,
      igstRate: igstRate || 0,
      igstAmount: igstAmount || 0,
      unroundedTotal: unroundedTotal || 0,
      roundOffAmount: roundOffAmount || 0,
      grandTotal: grandTotal || 0,
      amountInWords,
      status,
      notes,
      terms,
      companySnapshot: companySnapshot || {},
      bankSnapshot: bankSnapshot || {}
    });

    // Update the customer contact's lead status to 'invoice_generated' in CRM
    if (customerId) {
      const contact = await Contact.findOne({ _id: customerId, userId: req.userId });
      if (contact) {
        if (!contact.customFields) contact.customFields = new Map();
        contact.customFields.set('status', 'invoice_generated');
        contact.markModified('customFields');
        await contact.save();
      }
    }

    // Increment next invoice number in settings
    await InvoiceSettings.updateOne(
      { userId: req.userId },
      { $inc: { nextInvoiceNumber: 1 } }
    );

    res.status(201).json({ success: true, data: { invoice } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create invoice', details: error.message });
  }
});

// GET /api/invoices/:id - Get single invoice
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, data: { invoice } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch invoice' });
  }
});

// PUT /api/invoices/:id/status - Update invoice status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { status } },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Sync CRM lead status if invoice status changes to paid or payment_due
    if (invoice.customerId) {
      const contact = await Contact.findOne({ _id: invoice.customerId, userId: req.userId });
      if (contact) {
        if (!contact.customFields) contact.customFields = new Map();
        if (status === 'paid') {
          contact.customFields.set('status', 'won');
        } else if (status === 'payment_due') {
          contact.customFields.set('status', 'payment_due');
        }
        contact.markModified('customFields');
        await contact.save();
      }
    }

    // Auto-trigger WhatsApp templates
    const {
      sendInvoicePaymentReceived,
      sendInvoicePaymentPending
    } = require('../services/invoiceAutomationService');

    if (status === 'paid') {
      sendInvoicePaymentReceived(invoice, req.body.transactionId || '').catch(err => {
        console.error('[Invoices] Error sending automatic payment_received template:', err.message);
      });
    } else if (status === 'payment_due') {
      sendInvoicePaymentPending(invoice).catch(err => {
        console.error('[Invoices] Error sending automatic payment_follow_up template:', err.message);
      });
    }

    res.json({ success: true, data: { invoice } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update invoice status' });
  }
});

// POST /api/invoices/:id/send-template - Send specific WhatsApp template on-demand (reminder, pending, received)
router.post('/:id/send-template', async (req, res) => {
  try {
    const { templateType, transactionId } = req.body;
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const {
      sendInvoicePaymentReminder,
      sendInvoicePaymentPending,
      sendInvoicePaymentReceived
    } = require('../services/invoiceAutomationService');

    let result;
    if (templateType === 'reminder') {
      result = await sendInvoicePaymentReminder(invoice, { manual: true });
    } else if (templateType === 'pending') {
      result = await sendInvoicePaymentPending(invoice, { manual: true });
    } else if (templateType === 'received') {
      result = await sendInvoicePaymentReceived(invoice, transactionId || '', { manual: true });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid templateType. Must be reminder, pending, or received' });
    }

    if (result.success) {
      const updatedInvoice = await Invoice.findById(invoice._id);
      res.json({
        success: true,
        message: `Template "${templateType}" sent successfully via WhatsApp!`,
        data: { invoice: updatedInvoice, messageId: result.messageId }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.reason || 'Failed to send template message'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to trigger template message', details: error.message });
  }
});

// POST /api/invoices/run-automation-check - Manually trigger the scheduled automation scan
router.post('/run-automation-check', async (req, res) => {
  try {
    const { checkAndRunInvoiceAutomations } = require('../services/invoiceAutomationService');
    const result = await checkAndRunInvoiceAutomations();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to run automation check', details: error.message });
  }
});

// DELETE /api/invoices/:id - Delete an invoice
router.delete('/:id', async (req, res) => {
  try {
    const result = await Invoice.deleteOne({ _id: req.params.id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
});

module.exports = router;
