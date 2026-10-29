const axios = require('axios');
const winston = require('winston');
const StoreOrder = require('../models/StoreOrder');
const {
  sendShippingStartedNotification,
  sendOutForDeliveryNotification,
  sendOrderDeliveredNotification,
} = require('./luscentNotificationService');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const DELHIVERY_API_KEY = process.env.DELHIVERY_PARTNER_API || '';
const DELHIVERY_TRACK_URL = 'https://track.delhivery.com/api/v1/packages/json/';

/**
 * Fetch tracking details from Delhivery API for a given AWB/Waybill
 */
async function fetchDelhiveryTracking(waybill) {
  if (!DELHIVERY_API_KEY || !waybill) {
    return null;
  }

  try {
    const response = await axios.get(DELHIVERY_TRACK_URL, {
      params: {
        waybill,
        token: DELHIVERY_API_KEY,
      },
      headers: {
        Authorization: `Token ${DELHIVERY_API_KEY}`,
      },
      timeout: 10000,
    });

    const data = response.data;
    if (data && data.ShipmentData && data.ShipmentData.length > 0) {
      const shipment = data.ShipmentData[0].Shipment;
      return {
        status: shipment.Status?.Status || '',
        statusCode: shipment.Status?.StatusCode || '',
        statusDateTime: shipment.Status?.StatusDateTime || '',
        statusLocation: shipment.Status?.StatusLocation || '',
        scans: shipment.Scans || [],
      };
    }
    return null;
  } catch (err) {
    logger.error(`Error querying Delhivery tracking for ${waybill}:`, err.message);
    return null;
  }
}

/**
 * Process tracking update for an order and trigger corresponding notification
 */
async function processOrderTrackingUpdate(order, currentStatus, location = '') {
  const normStatus = String(currentStatus).toUpperCase().trim();
  logger.info(`Processing tracking update for order ${order.orderId} (AWB: ${order.waybill}): ${normStatus}`);

  // 1. Shipped / In-Transit Check
  const isShipped = ['IN TRANSIT', 'DISPATCHED', 'MANIFESTED', 'PICKED UP', 'IN-TRANSIT'].some(s => normStatus.includes(s));
  if (isShipped && !order.notifications.shippingStarted?.sent) {
    logger.info(`Triggering Shipping Started for order ${order.orderId}`);
    await sendShippingStartedNotification(order);
  }

  // 2. Out For Delivery Check
  const isOutForDelivery = ['OUT FOR DELIVERY', 'OUT_FOR_DELIVERY', 'OFD'].some(s => normStatus.includes(s));
  if (isOutForDelivery && !order.notifications.outForDelivery?.sent) {
    logger.info(`Triggering Out for Delivery for order ${order.orderId}`);
    await sendOutForDeliveryNotification(order);
  }

  // 3. Delivered Check
  const isDelivered = ['DELIVERED', 'DL'].some(s => normStatus === s || normStatus.includes('DELIVERED'));
  if (isDelivered && !order.notifications.orderDelivered?.sent) {
    logger.info(`Triggering Order Delivered for order ${order.orderId}`);
    await sendOrderDeliveredNotification(order);
  }

  // Save history
  order.trackingHistory.push({
    status: currentStatus,
    location,
    timestamp: new Date(),
    details: `Delhivery status: ${currentStatus}`,
  });
  await order.save();
}

/**
 * Poll all active orders that have a waybill but are not yet delivered
 */
async function syncActiveOrdersTracking() {
  try {
    const activeOrders = await StoreOrder.find({
      waybill: { $exists: true, $ne: '' },
      trackingStatus: { $nin: ['DELIVERED', 'CANCELLED'] },
    }).limit(50);

    logger.info(`Found ${activeOrders.length} active shipments to track with Delhivery.`);

    for (const order of activeOrders) {
      const tracking = await fetchDelhiveryTracking(order.waybill);
      if (tracking && tracking.status) {
        await processOrderTrackingUpdate(order, tracking.status, tracking.statusLocation);
      }
      // Small pause between tracking requests to avoid rate limits
      await new Promise(r => setTimeout(r, 600));
    }
  } catch (err) {
    logger.error('Error during Delhivery active tracking sync:', err);
  }
}

/**
 * Handle incoming webhook payload from Delhivery (if configured in Delhivery client portal)
 */
async function handleDelhiveryWebhook(payload) {
  try {
    const waybill = payload.waybill || payload.awb || payload.Shipment?.AWB;
    const status = payload.status || payload.Status?.Status || payload.Shipment?.Status?.Status;
    const location = payload.location || payload.Status?.StatusLocation || '';

    if (!waybill) {
      return { success: false, error: 'No waybill found in webhook payload' };
    }

    const order = await StoreOrder.findOne({ waybill });
    if (!order) {
      logger.warn(`Delhivery webhook received for unknown waybill: ${waybill}`);
      return { success: false, error: 'Order not found for waybill' };
    }

    await processOrderTrackingUpdate(order, status, location);
    return { success: true };
  } catch (err) {
    logger.error('Error in handleDelhiveryWebhook:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  fetchDelhiveryTracking,
  processOrderTrackingUpdate,
  syncActiveOrdersTracking,
  handleDelhiveryWebhook,
};

