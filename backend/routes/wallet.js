const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Organization = require('../models/Organization');
const WalletTransaction = require('../models/WalletTransaction');
const walletService = require('../services/walletService');
const razorpayService = require('../services/razorpayService');
const { verifyToken } = require('../middleware/auth');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// Multer storage for UPI payment screenshots
const uploadDir = path.join(__dirname, '../uploads/wallet');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `upi-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// All wallet routes require authentication
router.use(verifyToken);

/**
 * GET /api/wallet/balance — Get current wallet balance
 */
router.get('/balance', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'No organization attached to user account' });
    }
    const data = await walletService.getWalletBalance(organizationId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching wallet balance:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch wallet balance' });
  }
});

/**
 * GET /api/wallet/rates — Get rate card
 */
router.get('/rates', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const rates = await walletService.getRates(organizationId);
    res.json({ success: true, data: rates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/wallet/stats — Spend & credit statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'No organization attached' });
    }

    const { balance, currency, lowBalanceThreshold } = await walletService.getWalletBalance(organizationId);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregate spend & credits
    const [todaySpendAgg, monthSpendAgg, totalCreditedAgg, totalDebitedAgg, categoryAgg] = await Promise.all([
      // Today spend
      WalletTransaction.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), type: 'debit', status: 'success', createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Month spend
      WalletTransaction.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), type: 'debit', status: 'success', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Total credited
      WalletTransaction.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), type: 'credit', status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Total debited
      WalletTransaction.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), type: 'debit', status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Category breakdown
      WalletTransaction.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), type: 'debit', status: 'success' } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ])
    ]);

    const todaySpend = Number((todaySpendAgg[0]?.total || 0).toFixed(2));
    const monthSpend = Number((monthSpendAgg[0]?.total || 0).toFixed(2));
    const totalCredited = Number((totalCreditedAgg[0]?.total || 0).toFixed(2));
    const totalDebited = Number((totalDebitedAgg[0]?.total || 0).toFixed(2));

    const categoryBreakdown = {};
    categoryAgg.forEach(item => {
      categoryBreakdown[item._id] = {
        amount: Number(item.total.toFixed(2)),
        count: item.count
      };
    });

    res.json({
      success: true,
      data: {
        balance,
        currency,
        lowBalanceThreshold,
        todaySpend,
        monthSpend,
        totalCredited,
        totalDebited,
        categoryBreakdown
      }
    });
  } catch (error) {
    logger.error('Error fetching wallet stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/wallet/transactions — Ledger / Passbook with filters & pagination
 */
router.get('/transactions', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'No organization attached' });
    }

    const {
      page = 1,
      limit = 20,
      type,
      category,
      status,
      search,
      startDate,
      endDate
    } = req.query;

    const query = { organizationId: new mongoose.Types.ObjectId(organizationId) };

    if (type && ['credit', 'debit'].includes(type)) {
      query.type = type;
    }
    if (category) {
      query.category = category;
    }
    if (status) {
      query.status = status;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { transactionId: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
        { 'paymentDetails.utrNumber': { $regex: s, $options: 'i' } },
        { 'paymentDetails.invoiceNumber': { $regex: s, $options: 'i' } },
        { 'metaData.recipientPhone': { $regex: s, $options: 'i' } },
        { 'metaData.campaignName': { $regex: s, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      WalletTransaction.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wallet/create-razorpay-order — Create Razorpay order for top-up
 */
router.post('/create-razorpay-order', async (req, res) => {
  try {
    const { amount } = req.body;
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount < 10) {
      return res.status(400).json({ success: false, error: 'Minimum top-up amount is ₹10' });
    }

    if (!razorpayService.isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay is not configured on server. Please use UPI QR Code payment option.'
      });
    }

    const receipt = `topup_${Date.now()}`;
    const order = await razorpayService.createOrder(parsedAmount, 'INR', receipt);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: parsedAmount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    logger.error('Error creating Razorpay order for top-up:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to initiate payment' });
  }
});

/**
 * POST /api/wallet/verify-razorpay-payment — Verify payment & credit wallet
 */
router.post('/verify-razorpay-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required payment verification details' });
    }

    const isValid = razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
    }

    const organizationId = req.user.organizationId;
    const io = req.app.get('io');

    const result = await walletService.creditWallet({
      organizationId,
      userId: req.user.id || req.user._id,
      amount: Number(amount),
      category: 'topup_razorpay',
      paymentDetails: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      },
      description: `Razorpay Online Recharge (ID: ${razorpay_payment_id})`,
      io
    });

    res.json({
      success: true,
      message: 'Wallet recharged successfully!',
      data: result
    });
  } catch (error) {
    logger.error('Error verifying Razorpay payment:', error);
    res.status(500).json({ success: false, error: error.message || 'Payment verification failed' });
  }
});

/**
 * POST /api/wallet/upload-screenshot — Upload screenshot for UPI payment
 */
router.post('/upload-screenshot', upload.single('screenshot'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded' });
  }
  const fileUrl = `/uploads/wallet/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

/**
 * POST /api/wallet/submit-upi-topup — Submit UPI QR payment request with UTR
 */
router.post('/submit-upi-topup', async (req, res) => {
  try {
    const { amount, utrNumber, screenshot, notes } = req.body;
    const organizationId = req.user.organizationId;
    const io = req.app.get('io');

    const transaction = await walletService.submitUpiTopup({
      organizationId,
      userId: req.user.id || req.user._id,
      amount: Number(amount),
      utrNumber,
      screenshot,
      notes,
      io
    });

    res.json({
      success: true,
      message: 'Payment reference submitted! Your wallet will be credited upon admin verification.',
      data: transaction
    });
  } catch (error) {
    logger.error('Error submitting UPI top-up:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// ================= ADMIN ROUTES (SUPERADMIN ONLY) =================

/**
 * GET /api/wallet/admin/pending-topups — View pending UPI requests (SuperAdmin Only)
 */
router.get('/admin/pending-topups', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Only SuperAdmin can view pending payment approvals' });
    }

    const query = { status: 'pending', category: 'topup_upi_qr' };

    const pending = await WalletTransaction.find(query)
      .populate('organizationId', 'name contactEmail contactNumber')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wallet/admin/approve-topup — Approve UPI top-up (SuperAdmin Only)
 */
router.post('/admin/approve-topup', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Only SuperAdmin can approve wallet top-ups' });
    }

    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ success: false, error: 'transactionId is required' });

    const io = req.app.get('io');
    const result = await walletService.approveUpiTopup({
      transactionId,
      adminUserId: req.user.id || req.user._id,
      io
    });

    res.json({ success: true, message: 'Top-up approved and credited to wallet!', data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wallet/admin/reject-topup — Reject UPI top-up (SuperAdmin Only)
 */
router.post('/admin/reject-topup', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Only SuperAdmin can reject wallet top-ups' });
    }

    const { transactionId, reason } = req.body;
    if (!transactionId) return res.status(400).json({ success: false, error: 'transactionId is required' });

    const result = await walletService.rejectUpiTopup({
      transactionId,
      adminUserId: req.user.id || req.user._id,
      reason: reason || 'Invalid payment verification'
    });

    res.json({ success: true, message: 'Top-up request rejected', data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wallet/admin/update-rates — Update Platform Rate Card (SuperAdmin Only)
 */
router.post('/admin/update-rates', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Only SuperAdmin can update rate card' });
    }

    const { marketing, utility, authentication, service } = req.body;
    const WalletRateCard = require('../models/WalletRateCard');
    let defaultCard = await WalletRateCard.findOne({ isDefault: true });
    if (!defaultCard) {
      defaultCard = new WalletRateCard({ isDefault: true });
    }
    if (marketing !== undefined) defaultCard.marketing = parseFloat(marketing);
    if (utility !== undefined) defaultCard.utility = parseFloat(utility);
    if (authentication !== undefined) defaultCard.authentication = parseFloat(authentication);
    if (service !== undefined) defaultCard.service = parseFloat(service);
    await defaultCard.save();

    res.json({ success: true, message: 'Platform conversation rates updated successfully!', data: defaultCard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wallet/admin/manual-adjustment — Superadmin manual credit/debit
 */
router.post('/admin/manual-adjustment', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Only SuperAdmin can perform manual balance adjustments' });
    }

    const { organizationId, type, amount, reason } = req.body;
    if (!organizationId || !type || !amount) {
      return res.status(400).json({ success: false, error: 'Missing organizationId, type, or amount' });
    }

    const io = req.app.get('io');
    const result = await walletService.manualAdjustment({
      organizationId,
      adminUserId: req.user.id || req.user._id,
      type,
      amount: Number(amount),
      reason: reason || 'SuperAdmin manual adjustment',
      io
    });

    res.json({ success: true, message: `Balance successfully ${type === 'credit' ? 'credited' : 'debited'}!`, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/wallet/admin/all-wallets — Superadmin view all organization balances
 */
router.get('/admin/all-wallets', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    const orgs = await Organization.find({})
      .select('name contactEmail contactNumber walletBalance walletCurrency status createdAt')
      .sort({ walletBalance: -1 })
      .lean();

    res.json({ success: true, data: orgs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
