const axios = require('axios');
const winston = require('winston');
const StoreOrder = require('../models/StoreOrder');
const {
  sendOrderConfirmedNotification,
  sendPaymentReceivedNotification,
  sendShippingStartedNotification,
  sendOutForDeliveryNotification,
  sendOrderDeliveredNotification,
} = require('./luscentNotificationService');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const LUSCENT_API_BASE = 'https://api.luscentglow.com';
let cachedToken = null;
let tokenExpiresAt = 0;

// Cutoff timestamp: Never send any automated messages to orders placed before this service was activated!
const HISTORICAL_CUTOFF_TIME = new Date('2026-10-30T06:35:00.000Z');

/**
 * Obtain or reuse JWT token for Luscent Glow Admin API
 */
async function getAdminToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const username = process.env.LUSCENT_ADMIN_PANEL_USERNAME || 'admin';
  const password = process.env.LUSCENT_ADMIN_PANEL_PASSWORD || 'adminsecret';

  try {
    const res = await axios.post(`${LUSCENT_API_BASE}/api/admin/login`, {
      username: username.trim(),
      password: password.trim(),
    }, { timeout: 10000 });

    if (res.data && res.data.token) {
      cachedToken = res.data.token;
      tokenExpiresAt = now + 12 * 60 * 60 * 1000; // cache for 12 hours
      logger.info('Successfully authenticated with Luscent Glow Admin API');
      return cachedToken;
    }
    throw new Error('No token returned from Luscent login');
  } catch (err) {
    logger.error('Failed to login to Luscent Glow Admin API:', err.message);
    throw err;
  }
}

/**
 * Fetch orders from Luscent Glow Admin API
 */
async function fetchLuscentOrders() {
  const token = await getAdminToken();
  const res = await axios.get(`${LUSCENT_API_BASE}/api/admin/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000,
  });
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * Process a single Luscent order and trigger corresponding WhatsApp notifications
 */
async function syncSingleOrder(rawOrder) {
  try {
    const orderId = rawOrder.order_number || rawOrder._id || String(rawOrder.id);
    if (!orderId || !rawOrder.phone) return;

    const orderCreatedAt = new Date(rawOrder.created_at || 0);
    const isHistoricalOrder = orderCreatedAt < HISTORICAL_CUTOFF_TIME;

    let storeOrder = await StoreOrder.findOne({ store: 'luscentglow', orderId });

    const totalAmount = Number(rawOrder.totalPrice || rawOrder.total || 0);
    const paymentMethod = String(rawOrder.paymentMethod || 'Online');
    const paymentStatus = String(rawOrder.paymentStatus || 'unpaid').toUpperCase();
    const currentStatus = String(rawOrder.status || 'pending').toLowerCase();
    const trackingNumber = rawOrder.tracking_number || '';
    const delhiveryStatus = String(rawOrder.delhivery_status || '').toLowerCase();

    const normalizedItems = (rawOrder.items && rawOrder.items.length > 0)
      ? rawOrder.items.map(it => ({
          name: it.name || it.title || 'Luscent Glow Product',
          quantity: it.quantity || 1,
          price: it.price || 0,
          total: (it.price || 0) * (it.quantity || 1),
        }))
      : [{ name: 'Luscent Glow Skincare Product', quantity: 1, price: totalAmount, total: totalAmount }];

    const fullAddress = [rawOrder.address, rawOrder.city, rawOrder.state, rawOrder.pincode].filter(Boolean).join(', ');

    if (!storeOrder) {
      storeOrder = new StoreOrder({
        store: 'luscentglow',
        orderId,
        customerName: rawOrder.name || 'Valued Customer',
        customerPhone: rawOrder.phone,
        customerEmail: rawOrder.email || '',
        shippingAddress: fullAddress,
        items: normalizedItems,
        totalAmount,
        paymentMethod,
        paymentStatus,
        transactionId: rawOrder.paymentId || '',
        waybill: trackingNumber,
        trackingStatus: currentStatus.toUpperCase(),
        rawPayload: rawOrder,
      });

      // If it's a historical order, save it with all notifications marked as sent so no messages ever go out!
      if (isHistoricalOrder) {
        storeOrder.notifications.orderConfirmed.sent = true;
        storeOrder.notifications.orderConfirmed.sentAt = orderCreatedAt;
        storeOrder.notifications.paymentReceived.sent = true;
        storeOrder.notifications.paymentReceived.sentAt = orderCreatedAt;
        storeOrder.notifications.shippingStarted.sent = true;
        storeOrder.notifications.shippingStarted.sentAt = orderCreatedAt;
        storeOrder.notifications.outForDelivery.sent = true;
        storeOrder.notifications.outForDelivery.sentAt = orderCreatedAt;
        storeOrder.notifications.orderDelivered.sent = true;
        storeOrder.notifications.orderDelivered.sentAt = orderCreatedAt;
        await storeOrder.save();
        return;
      }

      await storeOrder.save();

      // Trigger 1: Order Confirmed (ONLY FOR NEW ORDERS PLACED AFTER CUTOFF)
      logger.info(`[LUSCENT SYNC] New live order detected: #${orderId}! Dispatching order_confirmed_template...`);
      await sendOrderConfirmedNotification(storeOrder);

      // Trigger 2: Payment Received (ONLY FOR NEW ORDERS PLACED AFTER CUTOFF)
      if (paymentStatus === 'PAID' || ['online', 'razorpay', 'cashfree', 'upi', 'card'].includes(paymentMethod.toLowerCase())) {
        logger.info(`[LUSCENT SYNC] Online payment confirmed for #${orderId}! Dispatching payment_received_template...`);
        await sendPaymentReceivedNotification(storeOrder);
      }
    } else {
      // Historical orders are completely muted
      if (isHistoricalOrder) {
        return;
      }

      // Order already exists, check for live status changes
      let isUpdated = false;

      if (trackingNumber && !storeOrder.waybill) {
        storeOrder.waybill = trackingNumber;
        isUpdated = true;
      }

      // Check for shipping trigger
      const isShipped = currentStatus === 'shipped' || delhiveryStatus.includes('manifest') || delhiveryStatus.includes('transit') || delhiveryStatus.includes('dispatched');
      if (isShipped && !storeOrder.notifications.shippingStarted?.sent) {
        logger.info(`[LUSCENT SYNC] Order #${orderId} has been shipped! Dispatching shipping_started_template...`);
        await sendShippingStartedNotification(storeOrder, trackingNumber);
      }

      // Check for out for delivery trigger
      const isOFD = currentStatus === 'out_for_delivery' || delhiveryStatus.includes('out for delivery') || delhiveryStatus.includes('ofd');
      if (isOFD && !storeOrder.notifications.outForDelivery?.sent) {
        logger.info(`[LUSCENT SYNC] Order #${orderId} is Out for Delivery! Dispatching out_for_delivery_template...`);
        await sendOutForDeliveryNotification(storeOrder);
      }

      // Check for delivered trigger
      const isDelivered = currentStatus === 'delivered' || delhiveryStatus.includes('delivered');
      if (isDelivered && !storeOrder.notifications.orderDelivered?.sent) {
        logger.info(`[LUSCENT SYNC] Order #${orderId} has been delivered! Dispatching order_delivered_template...`);
        await sendOrderDeliveredNotification(storeOrder);
      }

      if (isUpdated) {
        await storeOrder.save();
      }
    }
  } catch (err) {
    logger.error(`Error syncing Luscent order ${rawOrder.order_number}:`, err);
  }
}

let isSyncRunning = false;

/**
 * Main polling sync function
 */
async function syncLuscentOrders() {
  if (isSyncRunning) return;
  isSyncRunning = true;

  try {
    const orders = await fetchLuscentOrders();
    orders.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    for (const rawOrder of orders) {
      await syncSingleOrder(rawOrder);
    }
  } catch (err) {
    logger.error('Error during Luscent orders sync cycle:', err.message);
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Start the real-time background sync loop
 */
function startLuscentOrderWatcher(intervalMs = 10000) {
  logger.info(`[LUSCENT SYNC] Starting Luscent Glow live order watcher (every ${intervalMs / 1000}s)...`);
  syncLuscentOrders();
  const timer = setInterval(syncLuscentOrders, intervalMs);
  return timer;
}

module.exports = {
  getAdminToken,
  fetchLuscentOrders,
  syncLuscentOrders,
  startLuscentOrderWatcher,
};
