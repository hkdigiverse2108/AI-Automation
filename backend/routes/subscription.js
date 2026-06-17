const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, requireRole } = require('../middleware/auth');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const razorpayService = require('../services/razorpayService');
const env = require('../config/env');

// Screenshot upload for offline payments
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/payment-screenshots');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `payment-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  }
});

const cloudinaryService = require('../services/cloudinaryService');
const screenshotUpload = multer({
  storage: cloudinaryService.isConfigured() ? multer.memoryStorage() : screenshotStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(verifyToken);

// ============================================================
//  ADMIN (ORGANIZATION) ROUTES
// ============================================================

/**
 * GET /api/subscription/plans
 * Get plan pricing configuration.
 */
router.get('/plans', async (req, res) => {
  try {
    const config = await SubscriptionPlan.getConfig();
    const plans = [1, 3, 6, 12].map((months) => {
      const { baseAmount, taxAmount, totalAmount } = config.calculatePrice(months);
      return { months, baseAmount, taxAmount, totalAmount };
    });

    res.json({
      success: true,
      data: {
        monthlyPrice: config.monthlyPrice,
        currency: config.currency,
        taxPercentage: config.taxPercentage,
        plans
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch plans', details: error.message });
  }
});

/**
 * GET /api/subscription/current
 * Get current organization subscription.
 */
router.get('/current', async (req, res) => {
  try {
    const org = await Organization.findById(req.organizationId).lean();
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    let subscription = null;
    if (org.currentSubscriptionId) {
      subscription = await Subscription.findById(org.currentSubscriptionId).lean();
    }

    const now = new Date();
    let remainingDays = 0;
    if (org.subscriptionExpiryDate) {
      remainingDays = Math.max(0, Math.ceil((new Date(org.subscriptionExpiryDate) - now) / (1000 * 60 * 60 * 24)));
    }

    res.json({
      success: true,
      data: {
        subscriptionStatus: org.subscriptionStatus || 'trial',
        subscriptionExpiryDate: org.subscriptionExpiryDate,
        remainingDays,
        subscription,
        organizationName: org.name
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription', details: error.message });
  }
});

/**
 * POST /api/subscription/create-order
 * Create a Razorpay order for online payment.
 */
router.post('/create-order', async (req, res) => {
  try {
    const { months } = req.body;
    if (![1, 3, 6, 12].includes(months)) {
      return res.status(400).json({ success: false, error: 'Invalid plan duration. Choose 1, 3, 6, or 12 months.' });
    }

    if (!razorpayService.isConfigured()) {
      return res.status(503).json({ success: false, error: 'Online payment is not configured. Please contact support.' });
    }

    const config = await SubscriptionPlan.getConfig();
    const { baseAmount, taxAmount, totalAmount } = config.calculatePrice(months);

    const order = await razorpayService.createOrder(totalAmount, config.currency, `sub_${req.organizationId}_${months}m`);

    // Create a pending payment record
    const payment = await Payment.create({
      organizationId: req.organizationId,
      amount: baseAmount,
      taxAmount,
      totalAmount,
      paymentMethod: 'razorpay',
      razorpayOrderId: order.id,
      planMonths: months,
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: totalAmount,
        currency: config.currency,
        paymentId: payment._id,
        keyId: env.RAZORPAY_KEY_ID,
        planMonths: months
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create order', details: error.message });
  }
});

/**
 * POST /api/subscription/verify-payment
 * Verify Razorpay payment and activate subscription.
 */
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !paymentId) {
      return res.status(400).json({ success: false, error: 'Missing payment verification fields' });
    }

    // Verify signature
    const isValid = razorpayService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      await Payment.updateOne({ _id: paymentId }, { status: 'failed' });
      return res.status(400).json({ success: false, error: 'Payment verification failed. Invalid signature.' });
    }

    // Update payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.transactionId = razorpay_payment_id;
    payment.status = 'paid';
    await payment.save();

    // Activate subscription
    const subscription = await activateSubscription(payment);

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'SUBSCRIPTION_PAYMENT_ONLINE',
      resource: 'Payment',
      resourceId: payment._id.toString(),
      newValue: { planMonths: payment.planMonths, totalAmount: payment.totalAmount },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      data: { payment: payment.toObject(), subscription: subscription.toObject() },
      message: 'Payment verified and subscription activated!'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Payment verification failed', details: error.message });
  }
});

/**
 * POST /api/subscription/offline-payment
 * Submit offline payment with screenshot.
 */
router.post('/offline-payment', screenshotUpload.single('screenshot'), async (req, res) => {
  try {
    const { months, transactionId, notes } = req.body;
    const monthsNum = parseInt(months, 10);
    if (![1, 3, 6, 12].includes(monthsNum)) {
      return res.status(400).json({ success: false, error: 'Invalid plan duration' });
    }

    let screenshotUrl = '';
    if (req.file) {
      if (cloudinaryService.isConfigured()) {
        screenshotUrl = await cloudinaryService.uploadStream(req.file.buffer, 'payment-screenshots', 'auto', req.file.originalname);
      } else {
        screenshotUrl = `/uploads/payment-screenshots/${req.file.filename}`;
      }
    }

    const config = await SubscriptionPlan.getConfig();
    const { baseAmount, taxAmount, totalAmount } = config.calculatePrice(monthsNum);

    const payment = await Payment.create({
      organizationId: req.organizationId,
      amount: baseAmount,
      taxAmount,
      totalAmount,
      paymentMethod: transactionId ? 'bank_transfer' : 'cash',
      transactionId: transactionId || '',
      screenshot: screenshotUrl,
      notes: notes || '',
      planMonths: monthsNum,
      status: 'pending'
    });

    // Create pending subscription
    const now = new Date();
    const org = await Organization.findById(req.organizationId);
    const startDate = org.subscriptionExpiryDate && new Date(org.subscriptionExpiryDate) > now
      ? new Date(org.subscriptionExpiryDate) : now;

    const expiryDate = new Date(startDate);
    expiryDate.setMonth(expiryDate.getMonth() + monthsNum);

    const subscription = await Subscription.create({
      organizationId: req.organizationId,
      planMonths: monthsNum,
      amount: baseAmount,
      taxAmount,
      totalAmount,
      startDate,
      expiryDate,
      status: 'pending',
      paymentId: payment._id
    });

    payment.subscriptionId = subscription._id;
    await payment.save();

    // Notify super admins
    const superAdmins = await User.find({ role: 'superadmin', isDeleted: { $ne: true } }).select('_id').lean();
    for (const sa of superAdmins) {
      await Notification.create({
        user: sa._id,
        organization: req.organizationId,
        type: 'subscription',
        title: 'New Offline Payment — Verification Required',
        message: `${org.name} submitted an offline payment of ₹${totalAmount} for ${monthsNum} month(s). Please verify.`,
        link: '/dashboard/admin',
        icon: 'credit-card'
      });
    }

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'SUBSCRIPTION_OFFLINE_PAYMENT_SUBMITTED',
      resource: 'Payment',
      resourceId: payment._id.toString(),
      newValue: { planMonths: monthsNum, totalAmount },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      data: { payment: payment.toObject(), subscription: subscription.toObject() },
      message: 'Offline payment submitted. Awaiting verification by admin.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to submit offline payment', details: error.message });
  }
});

/**
 * GET /api/subscription/payments
 * Payment history for the current organization.
 */
router.get('/payments', async (req, res) => {
  try {
    const payments = await Payment.find({ organizationId: req.organizationId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch payment history', details: error.message });
  }
});

// ============================================================
//  SUPER ADMIN ROUTES
// ============================================================

/**
 * GET /api/subscription/admin/dashboard
 * Subscription management dashboard stats.
 */
router.get('/admin/dashboard', requireRole('superadmin'), async (req, res) => {
  try {
    const totalOrgs = await Organization.countDocuments();
    const activePlans = await Organization.countDocuments({ subscriptionStatus: 'active' });
    const expiringPlans = await Organization.countDocuments({ subscriptionStatus: 'expiring_soon' });
    const expiredPlans = await Organization.countDocuments({ subscriptionStatus: 'expired' });
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });

    // Revenue calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const yearlyRevenue = await Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: startOfYear } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Daily revenue for chart (last 30 days)
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const dailyRevenue = await Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalOrgs,
        activePlans,
        expiringPlans,
        expiredPlans,
        pendingPayments,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        yearlyRevenue: yearlyRevenue[0]?.total || 0,
        dailyRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats', details: error.message });
  }
});

/**
 * GET /api/subscription/admin/organizations
 * All organizations with subscription details.
 */
router.get('/admin/organizations', requireRole('superadmin'), async (req, res) => {
  try {
    const orgs = await Organization.find({}).sort('-createdAt').lean();
    const now = new Date();

    const data = await Promise.all(
      orgs.map(async (org) => {
        const adminUser = await User.findOne({
          organizationId: org._id,
          role: { $in: ['admin', 'owner'] },
          isDeleted: { $ne: true }
        }).select('name email mobileNumber').lean();

        // Get latest paid payment
        const latestPayment = await Payment.findOne({
          organizationId: org._id,
          status: 'paid'
        }).sort('-createdAt').lean();

        const remainingDays = org.subscriptionExpiryDate
          ? Math.max(0, Math.ceil((new Date(org.subscriptionExpiryDate) - now) / (1000 * 60 * 60 * 24)))
          : 0;

        return {
          _id: org._id,
          name: org.name,
          ownerName: adminUser ? adminUser.name : 'N/A',
          ownerEmail: adminUser ? adminUser.email : 'N/A',
          ownerMobile: adminUser ? adminUser.mobileNumber || '' : '',
          subscriptionStatus: org.subscriptionStatus || 'trial',
          subscriptionExpiryDate: org.subscriptionExpiryDate,
          remainingDays,
          currentPlan: latestPayment ? `${latestPayment.planMonths} Month(s)` : 'None',
          amountPaid: latestPayment ? latestPayment.totalAmount : 0,
          startDate: latestPayment ? latestPayment.createdAt : null
        };
      })
    );

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch organizations', details: error.message });
  }
});

/**
 * PUT /api/subscription/admin/plan-config
 * Update global plan pricing.
 */
router.put('/admin/plan-config', requireRole('superadmin'), async (req, res) => {
  try {
    const { monthlyPrice, currency, taxPercentage, gracePeriodDays } = req.body;
    const config = await SubscriptionPlan.getConfig();

    if (monthlyPrice !== undefined) config.monthlyPrice = monthlyPrice;
    if (currency) config.currency = currency;
    if (taxPercentage !== undefined) config.taxPercentage = taxPercentage;
    if (gracePeriodDays !== undefined) config.gracePeriodDays = gracePeriodDays;
    config.updatedBy = req.user._id;

    await config.save();

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'PLAN_CONFIG_UPDATED',
      resource: 'SubscriptionPlan',
      resourceId: config._id.toString(),
      newValue: { monthlyPrice: config.monthlyPrice, taxPercentage: config.taxPercentage, gracePeriodDays: config.gracePeriodDays },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, data: config, message: 'Plan configuration updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update plan config', details: error.message });
  }
});

/**
 * GET /api/subscription/admin/pending-payments
 * List offline payments pending verification.
 */
router.get('/admin/pending-payments', requireRole('superadmin'), async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'pending', paymentMethod: { $in: ['cash', 'bank_transfer'] } })
      .sort('-createdAt')
      .populate('organizationId', 'name contactEmail contactNumber')
      .lean();

    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch pending payments', details: error.message });
  }
});

/**
 * POST /api/subscription/admin/verify/:paymentId
 * Approve or reject an offline payment.
 */
router.post('/admin/verify/:paymentId', requireRole('superadmin'), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action, rejectionReason } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action must be "approve" or "reject"' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Payment has already been processed' });
    }

    if (action === 'reject') {
      payment.status = 'rejected';
      payment.rejectionReason = rejectionReason || 'Payment rejected by admin';
      payment.verifiedBy = req.user._id;
      payment.verifiedAt = new Date();
      await payment.save();

      // Update pending subscription
      if (payment.subscriptionId) {
        await Subscription.updateOne({ _id: payment.subscriptionId }, { status: 'expired' });
      }

      // Notify org admin
      const org = await Organization.findById(payment.organizationId);
      const orgAdmins = await User.find({
        organizationId: payment.organizationId,
        role: { $in: ['admin', 'owner'] },
        isDeleted: { $ne: true }
      }).select('_id').lean();

      for (const admin of orgAdmins) {
        await Notification.create({
          user: admin._id,
          organization: payment.organizationId,
          type: 'subscription',
          title: 'Payment Rejected',
          message: `Your offline payment of ₹${payment.totalAmount} has been rejected. Reason: ${payment.rejectionReason}`,
          link: '/dashboard/subscription',
          icon: 'x-circle'
        });
      }

      await AuditLog.log({
        userId: req.userId,
        actorId: req.user._id,
        actorName: req.user.name,
        action: 'OFFLINE_PAYMENT_REJECTED',
        resource: 'Payment',
        resourceId: paymentId,
        newValue: { rejectionReason: payment.rejectionReason },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({ success: true, message: 'Payment rejected', data: payment.toObject() });
    }

    // Approve
    payment.status = 'paid';
    payment.verifiedBy = req.user._id;
    payment.verifiedAt = new Date();
    await payment.save();

    // Activate subscription
    const subscription = await activateSubscription(payment);

    // Notify org admin
    const orgAdmins = await User.find({
      organizationId: payment.organizationId,
      role: { $in: ['admin', 'owner'] },
      isDeleted: { $ne: true }
    }).select('_id').lean();

    for (const admin of orgAdmins) {
      await Notification.create({
        user: admin._id,
        organization: payment.organizationId,
        type: 'subscription',
        title: 'Payment Approved — Subscription Activated!',
        message: `Your payment of ₹${payment.totalAmount} has been approved. Your subscription is now active for ${payment.planMonths} month(s).`,
        link: '/dashboard/subscription',
        icon: 'check-circle'
      });
    }

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'OFFLINE_PAYMENT_APPROVED',
      resource: 'Payment',
      resourceId: paymentId,
      newValue: { planMonths: payment.planMonths, totalAmount: payment.totalAmount },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Payment approved and subscription activated',
      data: { payment: payment.toObject(), subscription: subscription.toObject() }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to verify payment', details: error.message });
  }
});

// ============================================================
//  HELPER: Activate subscription after successful payment
// ============================================================
async function activateSubscription(payment) {
  const now = new Date();
  const org = await Organization.findById(payment.organizationId);

  // Calculate start date: extend from current expiry if still active, else start from now
  const startDate = (org.subscriptionExpiryDate && new Date(org.subscriptionExpiryDate) > now)
    ? new Date(org.subscriptionExpiryDate)
    : now;

  const expiryDate = new Date(startDate);
  expiryDate.setMonth(expiryDate.getMonth() + payment.planMonths);

  let subscription;
  if (payment.subscriptionId) {
    // Update existing pending subscription
    subscription = await Subscription.findById(payment.subscriptionId);
    if (subscription) {
      subscription.startDate = startDate;
      subscription.expiryDate = expiryDate;
      subscription.status = 'active';
      await subscription.save();
    }
  }

  if (!subscription) {
    subscription = await Subscription.create({
      organizationId: payment.organizationId,
      planMonths: payment.planMonths,
      amount: payment.amount,
      taxAmount: payment.taxAmount,
      totalAmount: payment.totalAmount,
      startDate,
      expiryDate,
      status: 'active',
      paymentId: payment._id
    });
    payment.subscriptionId = subscription._id;
    await payment.save();
  }

  // Update organization
  org.subscriptionStatus = 'active';
  org.subscriptionExpiryDate = expiryDate;
  org.currentSubscriptionId = subscription._id;
  org.status = 'active';
  await org.save();

  // Re-enable all users in this org
  await User.updateMany({ organizationId: org._id, isDeleted: { $ne: true } }, { isSuspended: false });

  return subscription;
}

module.exports = router;
