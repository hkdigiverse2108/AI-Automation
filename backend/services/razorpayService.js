const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require('../config/env');

let razorpayInstance = null;

function getInstance() {
  if (!razorpayInstance && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpayInstance;
}

function isConfigured() {
  return !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/**
 * Create a Razorpay order.
 */
async function createOrder(amount, currency = 'INR', receipt = '') {
  const rp = getInstance();
  if (!rp) throw new Error('Razorpay is not configured');

  const options = {
    amount: amount * 100, // Razorpay expects paise
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    payment_capture: 1
  };

  const order = await rp.orders.create(options);
  return order;
}

/**
 * Verify Razorpay payment signature.
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!env.RAZORPAY_KEY_SECRET) throw new Error('Razorpay secret not configured');

  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

module.exports = {
  isConfigured,
  createOrder,
  verifyPaymentSignature
};
