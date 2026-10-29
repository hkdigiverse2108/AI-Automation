const router = require('express').Router();
const winston = require('winston');
const StoreOrder = require('../models/StoreOrder');
const {
  sendOrderConfirmedNotification,
  sendPaymentReceivedNotification,
  sendShippingStartedNotification,
  sendOutForDeliveryNotification,
  sendOrderDeliveredNotification,
} = require('./../services/luscentNotificationService');
const {
  handleDelhiveryWebhook,
  syncActiveOrdersTracking,
  fetchDelhiveryTracking,
  processOrderTrackingUpdate,
} = require('./../services/delhiveryTrackingService');
const { generateAndUploadInvoice } = require('./../services/invoiceGenerator');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * POST /api/store/luscent/order
 * Triggered when a new order is placed on luscentglow.com
 */
router.post('/order', async (req, res) => {
  try {
    const {
      orderId,
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      items,
      totalAmount,
      paymentMethod = 'Online',
      paymentStatus = 'PENDING',
      transactionId = '',
      waybill = '',
    } = req.body;

    if (!orderId || !customerPhone || !totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, customerPhone, totalAmount',
      });
    }

    logger.info(`Received new order from Luscent Glow: #${orderId} for ${customerName} (${customerPhone})`);

    // Upsert store order
    let storeOrder = await StoreOrder.findOne({ store: 'luscentglow', orderId });
    if (!storeOrder) {
      storeOrder = new StoreOrder({
        store: 'luscentglow',
        orderId,
        customerName: customerName || 'Valued Customer',
        customerPhone,
        customerEmail: customerEmail || '',
        shippingAddress: shippingAddress || '',
        items: Array.isArray(items) ? items : [],
        totalAmount: Number(totalAmount),
        paymentMethod,
        paymentStatus,
        transactionId,
        waybill,
        rawPayload: req.body,
      });
    } else {
      // Update fields if already exists
      storeOrder.customerName = customerName || storeOrder.customerName;
      storeOrder.customerPhone = customerPhone || storeOrder.customerPhone;
      storeOrder.shippingAddress = shippingAddress || storeOrder.shippingAddress;
      storeOrder.totalAmount = Number(totalAmount);
      storeOrder.paymentMethod = paymentMethod || storeOrder.paymentMethod;
      storeOrder.paymentStatus = paymentStatus || storeOrder.paymentStatus;
      storeOrder.transactionId = transactionId || storeOrder.transactionId;
      if (waybill) storeOrder.waybill = waybill;
    }

    await storeOrder.save();

    // 1. Immediately send Order Confirmed Notification
    const confirmResult = await sendOrderConfirmedNotification(storeOrder);

    // 2. If online payment is confirmed, send Payment Received Notification + Invoice
    let paymentResult = null;
    const isPaid = ['paid', 'success', 'captured'].includes(String(paymentStatus).toLowerCase()) ||
                   ['online', 'razorpay', 'cashfree', 'upi', 'card'].includes(String(paymentMethod).toLowerCase());

    if (isPaid) {
      paymentResult = await sendPaymentReceivedNotification(storeOrder);
    }

    res.json({
      success: true,
      message: 'Order saved and WhatsApp notifications dispatched',
      orderId,
      orderConfirmed: confirmResult.success,
      paymentReceived: paymentResult ? paymentResult.success : false,
      invoiceUrl: storeOrder.invoiceUrl,
    });
  } catch (err) {
    logger.error('Error processing Luscent order webhook:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/store/luscent/status-update
 * Triggered when admin updates order status (e.g. Shipped, Out for Delivery, Delivered)
 */
router.post('/status-update', async (req, res) => {
  try {
    const { orderId, status, waybill, trackingLocation } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, status',
      });
    }

    const storeOrder = await StoreOrder.findOne({ store: 'luscentglow', orderId });
    if (!storeOrder) {
      return res.status(404).json({ success: false, error: `Order #${orderId} not found` });
    }

    if (waybill) {
      storeOrder.waybill = waybill;
    }

    const normStatus = String(status).toUpperCase();
    let notificationResult = null;

    if (['SHIPPED', 'DISPATCHED', 'IN_TRANSIT'].includes(normStatus)) {
      notificationResult = await sendShippingStartedNotification(storeOrder, waybill);
    } else if (['OUT_FOR_DELIVERY', 'OFD'].includes(normStatus)) {
      notificationResult = await sendOutForDeliveryNotification(storeOrder);
    } else if (['DELIVERED'].includes(normStatus)) {
      notificationResult = await sendOrderDeliveredNotification(storeOrder);
    }

    // Save tracking history
    storeOrder.trackingHistory.push({
      status: normStatus,
      location: trackingLocation || '',
      timestamp: new Date(),
      details: `Status manually or API updated to ${normStatus}`,
    });
    await storeOrder.save();

    res.json({
      success: true,
      message: `Status updated to ${normStatus}`,
      orderId,
      notificationSent: notificationResult?.success || false,
    });
  } catch (err) {
    logger.error('Error updating order status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/store/luscent/payment-webhook
 * Triggered by Razorpay / Cashfree when payment is captured
 */
router.post('/payment-webhook', async (req, res) => {
  try {
    const body = req.body;
    let orderId = body.orderId || body.order_id || body.payload?.payment?.entity?.notes?.orderId;
    let txnId = body.transactionId || body.payload?.payment?.entity?.id || body.referenceId;
    let paymentStatus = body.status || body.payload?.payment?.entity?.status || 'PAID';

    if (!orderId && body.payload?.order?.entity?.id) {
      orderId = body.payload.order.entity.notes?.orderId || body.payload.order.entity.id;
    }

    if (!orderId) {
      return res.status(200).json({ success: true, message: 'No recognizable orderId in payment webhook' });
    }

    const storeOrder = await StoreOrder.findOne({ store: 'luscentglow', orderId });
    if (!storeOrder) {
      logger.warn(`Payment webhook received for non-existent order #${orderId}`);
      return res.status(200).json({ success: true, message: 'Order not found in store records' });
    }

    storeOrder.paymentStatus = 'PAID';
    if (txnId) storeOrder.transactionId = txnId;
    await storeOrder.save();

    const paymentResult = await sendPaymentReceivedNotification(storeOrder);

    res.json({
      success: true,
      message: 'Payment recorded and payment_received_template sent',
      orderId,
      paymentNotificationSent: paymentResult.success,
    });
  } catch (err) {
    logger.error('Error handling payment webhook:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/store/luscent/delhivery-webhook
 * Triggered by Delhivery logistics tracking push
 */
router.post('/delhivery-webhook', async (req, res) => {
  try {
    logger.info('Received Delhivery tracking webhook push', { body: req.body });
    const result = await handleDelhiveryWebhook(req.body);
    res.json(result);
  } catch (err) {
    logger.error('Error handling Delhivery webhook:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/store/luscent/sync-tracking
 * Manually trigger Delhivery active orders tracking sync
 */
router.post('/sync-tracking', async (req, res) => {
  try {
    await syncActiveOrdersTracking();
    res.json({ success: true, message: 'Tracking sync completed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/store/luscent/orders
 * List orders with notification statuses
 */
router.get('/orders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const orders = await StoreOrder.find({ store: 'luscentglow' })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/store/luscent/test-flow
 * Safe testing endpoint to simulate any template trigger without real website impact
 */
router.post('/test-flow', async (req, res) => {
  try {
    const {
      type = 'order_confirmed',
      phone,
      orderId = `TEST-${Date.now().toString().slice(-4)}`,
      customerName = 'Test User',
      totalAmount = 999,
      waybill = 'DELHIVERY123456',
    } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Recipient phone number is required' });
    }

    let storeOrder = await StoreOrder.findOne({ orderId });
    if (!storeOrder) {
      storeOrder = new StoreOrder({
        store: 'luscentglow',
        orderId,
        customerName,
        customerPhone: phone,
        shippingAddress: '402, Green Park, Pune, MH - 411001',
        items: [{ name: 'Luscent Glow Vitamin C Serum', quantity: 1, price: totalAmount, total: totalAmount }],
        totalAmount,
        paymentMethod: 'Online',
        paymentStatus: 'PAID',
        transactionId: `pay_test_${Date.now()}`,
        waybill,
      });
      await storeOrder.save();
    }

    let result = null;
    switch (type) {
      case 'order_confirmed':
        result = await sendOrderConfirmedNotification(storeOrder);
        break;
      case 'payment_received':
        result = await sendPaymentReceivedNotification(storeOrder);
        break;
      case 'shipping_started':
        result = await sendShippingStartedNotification(storeOrder, waybill);
        break;
      case 'out_for_delivery':
        result = await sendOutForDeliveryNotification(storeOrder);
        break;
      case 'order_delivered':
        result = await sendOrderDeliveredNotification(storeOrder);
        break;
      default:
        return res.status(400).json({ success: false, error: `Unknown template type: ${type}` });
    }

    res.json({
      success: true,
      type,
      recipient: phone,
      result,
      invoiceUrl: storeOrder.invoiceUrl,
    });
  } catch (err) {
    logger.error('Error in test-flow:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

