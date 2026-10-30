const winston = require('winston');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const { decryptField } = require('./encryption');
const { sendTemplateMessage, sendDocumentMessage } = require('./whatsapp');
const { generateAndUploadInvoice } = require('./invoiceGenerator');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Helper to get active Meta WhatsApp credentials
 */
async function getWhatsAppCredentials() {
  const envPhoneId = process.env.PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID;
  const envWabaId = process.env.WABA_ID || process.env.META_WABA_ID;

  let waAccount = null;
  if (envPhoneId) {
    waAccount = await WhatsAppAccount.findOne({ phoneNumberId: envPhoneId });
  }

  if (!waAccount) {
    waAccount = await WhatsAppAccount.findOne({ isActive: true });
  }

  if (!waAccount) {
    throw new Error('No active WhatsApp account found in system.');
  }

  let token = decryptField(waAccount.accessToken);
  if (!token && process.env.META_ACCESS_TOKEN && !process.env.META_ACCESS_TOKEN.startsWith('your_')) {
    token = process.env.META_ACCESS_TOKEN;
  }

  return {
    phoneNumberId: waAccount.phoneNumberId,
    token,
    wabaId: waAccount.wabaId,
  };
}

/**
 * Sanitize recipient phone number for WhatsApp Meta Cloud API (e.g. 919876543210)
 */
function sanitizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // already formatted
  }
  return cleaned;
}

/**
 * Format item summary string
 */
function getItemsSummary(items = []) {
  if (!items || items.length === 0) return 'Luscent Glow Skincare Product';
  return items.map(it => `${it.name || 'Product'} (x${it.quantity || 1})`).join(', ').substring(0, 80);
}

/**
 * Trigger 1: Order Confirmed Template
 */
async function sendOrderConfirmedNotification(storeOrder) {
  try {
    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(storeOrder.customerPhone);
    if (!recipient) {
      logger.warn(`No valid recipient phone for order ${storeOrder.orderId}`);
      return { success: false, error: 'Invalid phone number' };
    }

    const customerName = storeOrder.customerName || 'Valued Customer';
    const brandName = 'Luscent Glow';
    const orderId = storeOrder.orderId;
    const itemsSummary = getItemsSummary(storeOrder.items);
    const amountStr = `Rs. ${Number(storeOrder.totalAmount).toFixed(2)}`;
    const expectedDelivery = '3-5 Working Days';

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: customerName },
          { type: 'text', text: brandName },
          { type: 'text', text: orderId },
          { type: 'text', text: itemsSummary },
          { type: 'text', text: amountStr },
          { type: 'text', text: expectedDelivery },
        ],
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          { type: 'text', text: orderId },
        ],
      },
    ];

    logger.info(`Sending order_confirmed_template to ${recipient} for order ${orderId}`);
    let result = await sendTemplateMessage(phoneNumberId, token, recipient, 'order_confirmed_template', 'en', components);

    // If button parameter failed (e.g. if button is still quick reply during approval), fallback to body only
    if (!result.success && result.error && (result.error.includes('button') || result.error.includes('component'))) {
      result = await sendTemplateMessage(phoneNumberId, token, recipient, 'order_confirmed_template', 'en', [components[0]]);
    }

    if (result.success) {
      storeOrder.notifications.orderConfirmed = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      await storeOrder.save();
    } else {
      storeOrder.notifications.orderConfirmed.error = result.error || 'Failed to send';
      await storeOrder.save();
    }

    return result;
  } catch (err) {
    logger.error(`Error in sendOrderConfirmedNotification:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger 2: Payment Received Template (For Prepaid / Online Orders)
 */
async function sendPaymentReceivedNotification(storeOrder) {
  try {
    const isOnline = ['online', 'razorpay', 'cashfree', 'card', 'upi'].includes(
      String(storeOrder.paymentMethod || '').toLowerCase()
    ) || String(storeOrder.paymentStatus || '').toUpperCase() === 'PAID';

    if (!isOnline) {
      logger.info(`Order ${storeOrder.orderId} is COD. Skipping payment_received_template.`);
      return { success: true, skipped: true, reason: 'COD Order' };
    }

    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(storeOrder.customerPhone);

    // 1. Ensure Invoice PDF is generated
    let invoiceUrl = storeOrder.invoiceUrl;
    if (!invoiceUrl) {
      try {
        invoiceUrl = await generateAndUploadInvoice({
          orderId: storeOrder.orderId,
          customer: {
            name: storeOrder.customerName,
            phone: storeOrder.customerPhone,
            address: storeOrder.shippingAddress,
          },
          items: storeOrder.items,
          totalAmount: storeOrder.totalAmount,
          paymentMethod: storeOrder.paymentMethod,
          transactionId: storeOrder.transactionId || 'ONLINE_TXN',
        });
        storeOrder.invoiceUrl = invoiceUrl;
        await storeOrder.save();
      } catch (pdfErr) {
        logger.error(`Failed to generate invoice PDF for order ${storeOrder.orderId}:`, pdfErr);
      }
    }

    const brandName = 'Luscent Glow';
    const orderId = storeOrder.orderId;
    const itemsSummary = getItemsSummary(storeOrder.items);
    const amountStr = `Rs. ${Number(storeOrder.totalAmount).toFixed(2)}`;
    const txnId = storeOrder.transactionId || 'PREPAID_OK';
    const paymentDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: brandName },
          { type: 'text', text: orderId },
          { type: 'text', text: itemsSummary },
          { type: 'text', text: amountStr },
          { type: 'text', text: txnId },
          { type: 'text', text: paymentDate },
        ],
      },
    ];

    // Add button parameter for Download Receipt if invoice URL is ready
    if (invoiceUrl) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          { type: 'text', text: invoiceUrl },
        ],
      });
    }

    logger.info(`Sending payment_received_template to ${recipient} for order ${orderId}`);
    let result = await sendTemplateMessage(phoneNumberId, token, recipient, 'payment_received_template', 'en', components);

    // If button parameter failed (e.g. if button was static in Meta), retry without button component
    if (!result.success && result.error?.includes('button')) {
      logger.warn(`Retrying payment_received_template without button component...`);
      result = await sendTemplateMessage(phoneNumberId, token, recipient, 'payment_received_template', 'en', [components[0]]);
    }

    if (result.success) {
      storeOrder.notifications.paymentReceived = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      await storeOrder.save();

      // Optionally send the actual PDF document directly to chat so customer can view it instantly
      if (invoiceUrl) {
        try {
          await sendDocumentMessage(
            phoneNumberId,
            token,
            recipient,
            invoiceUrl,
            `Invoice_${storeOrder.orderId}.pdf`
          );
          logger.info(`Direct invoice document sent to ${recipient}`);
        } catch (docErr) {
          logger.warn(`Direct PDF document send optional warning:`, docErr.message);
        }
      }
    } else {
      storeOrder.notifications.paymentReceived.error = result.error || 'Failed to send';
      await storeOrder.save();
    }

    return result;
  } catch (err) {
    logger.error(`Error in sendPaymentReceivedNotification:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger 3: Shipping Started Template (When Delhivery AWB is created / dispatched)
 */
async function sendShippingStartedNotification(storeOrder, customAwb = null) {
  try {
    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(storeOrder.customerPhone);
    const orderId = storeOrder.orderId;
    const waybill = customAwb || storeOrder.waybill || '';

    const customerName = storeOrder.customerName || 'Valued Customer';
    const brandName = 'Luscent Glow';
    const itemsSummary = getItemsSummary(storeOrder.items);
    const courierPartner = 'Delhivery';
    const estDeliveryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: customerName },
          { type: 'text', text: brandName },
          { type: 'text', text: orderId },
          { type: 'text', text: itemsSummary },
          { type: 'text', text: courierPartner },
          { type: 'text', text: estDeliveryDate },
        ],
      },
    ];

    if (waybill) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          { type: 'text', text: waybill },
        ],
      });
    }

    logger.info(`Sending shipping_started_template to ${recipient} for order ${orderId} (AWB: ${waybill})`);
    let result = await sendTemplateMessage(phoneNumberId, token, recipient, 'shipping_started_template', 'en', components);

    if (!result.success && result.error?.includes('button')) {
      result = await sendTemplateMessage(phoneNumberId, token, recipient, 'shipping_started_template', 'en', [components[0]]);
    }

    if (result.success) {
      storeOrder.notifications.shippingStarted = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      storeOrder.trackingStatus = 'SHIPPED';
      await storeOrder.save();
    } else {
      storeOrder.notifications.shippingStarted.error = result.error || 'Failed to send';
      await storeOrder.save();
    }

    return result;
  } catch (err) {
    logger.error(`Error in sendShippingStartedNotification:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger 4: Out For Delivery Template (When courier boy is out to deliver)
 */
async function sendOutForDeliveryNotification(storeOrder) {
  try {
    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(storeOrder.customerPhone);
    const orderId = storeOrder.orderId;

    const customerName = storeOrder.customerName || 'Valued Customer';
    const brandName = 'Luscent Glow';
    const itemsSummary = getItemsSummary(storeOrder.items);
    const courierPartner = 'Delhivery';
    const expectedArrival = 'Today by 7:00 PM';

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: customerName },
          { type: 'text', text: orderId },
          { type: 'text', text: brandName },
          { type: 'text', text: itemsSummary },
          { type: 'text', text: courierPartner },
          { type: 'text', text: expectedArrival },
        ],
      },
    ];

    logger.info(`Sending out_for_delivery_template to ${recipient} for order ${orderId}`);
    const result = await sendTemplateMessage(phoneNumberId, token, recipient, 'out_for_delivery_template', 'en', components);

    if (result.success) {
      storeOrder.notifications.outForDelivery = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      storeOrder.trackingStatus = 'OUT_FOR_DELIVERY';
      await storeOrder.save();
    } else {
      storeOrder.notifications.outForDelivery.error = result.error || 'Failed to send';
      await storeOrder.save();
    }

    return result;
  } catch (err) {
    logger.error(`Error in sendOutForDeliveryNotification:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger 5: Order Delivered Template (When package is delivered)
 */
async function sendOrderDeliveredNotification(storeOrder) {
  try {
    const { phoneNumberId, token } = await getWhatsAppCredentials();
    const recipient = sanitizePhoneNumber(storeOrder.customerPhone);
    const orderId = storeOrder.orderId;

    const customerName = storeOrder.customerName || 'Valued Customer';
    const brandName = 'Luscent Glow';
    const deliveredTo = storeOrder.shippingAddress
      ? storeOrder.shippingAddress.split(',').slice(-2).join(', ').trim() || 'Your Address'
      : 'Your Address';
    const deliveryTime = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: customerName },
          { type: 'text', text: orderId },
          { type: 'text', text: brandName },
          { type: 'text', text: deliveredTo },
          { type: 'text', text: deliveryTime },
        ],
      },
    ];

    logger.info(`Sending order_delivered_template to ${recipient} for order ${orderId}`);
    const result = await sendTemplateMessage(phoneNumberId, token, recipient, 'order_delivered_template', 'en', components);

    if (result.success) {
      storeOrder.notifications.orderDelivered = {
        sent: true,
        sentAt: new Date(),
        messageId: result.data?.messages?.[0]?.id,
      };
      storeOrder.trackingStatus = 'DELIVERED';
      await storeOrder.save();
    } else {
      storeOrder.notifications.orderDelivered.error = result.error || 'Failed to send';
      await storeOrder.save();
    }

    return result;
  } catch (err) {
    logger.error(`Error in sendOrderDeliveredNotification:`, err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getWhatsAppCredentials,
  sanitizePhoneNumber,
  sendOrderConfirmedNotification,
  sendPaymentReceivedNotification,
  sendShippingStartedNotification,
  sendOutForDeliveryNotification,
  sendOrderDeliveredNotification,
};

