const router = require('express').Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const PaymentSubmission = require('../models/PaymentSubmission');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const Contact = require('../models/Contact');
const User = require('../models/User');
const Product = require('../models/Product');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const whatsapp = require('../services/whatsapp');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const { createNotification } = require('../services/notificationService');
const { decryptField } = require('../services/encryption');

router.use(verifyToken);
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
router.use(checkFeatureAccess('catalog'));

// Helper: Get WABA account for an organization
async function getWabaAccountForOrg(organizationId) {
  const users = await User.find({ organizationId, isDeleted: false }).select('_id');
  const userIds = users.map(u => u._id);
  const waAccount = await WhatsAppAccount.findOne({ userId: { $in: userIds }, isActive: true });
  if (!waAccount) return null;
  const token = decryptField(waAccount.accessToken);
  return { waAccount, token, phoneNumberId: waAccount.phoneNumberId };
}

// Helper: Send and Save WhatsApp update, and emit socket events
async function sendWhatsAppUpdate(req, order, text, imageUrl = null) {
  try {
    const contact = await Contact.findById(order.contactId);
    if (!contact) return;

    const wabaInfo = await getWabaAccountForOrg(order.organizationId);
    if (!wabaInfo) return;

    const { waAccount, token, phoneNumberId } = wabaInfo;
    const userId = waAccount.userId;

    const Conversation = require('../models/Conversation');
    const Message = require('../models/Message');
    const { getOekForUser, decryptMessage } = require('../services/oekService');

    let conversation = await Conversation.findOne({ userId, contactId: contact._id });
    if (!conversation) {
      conversation = await Conversation.create({
        userId,
        contactId: contact._id,
        status: 'bot',
        source: contact.source || 'direct',
        lastMessageAt: new Date(),
        organization_id: order.organizationId
      });
    }

    let result;
    let msgType = 'text';
    let content = { text };

    if (imageUrl) {
      msgType = 'image';
      content = { text, mediaUrl: imageUrl };
      result = await whatsapp.sendImageMessage(phoneNumberId, token, contact.phone, imageUrl, text);
    } else {
      result = await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, text);
    }

    const savedMsg = await Message.create({
      userId,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'outbound',
      type: msgType,
      content,
      status: result.success ? 'sent' : 'failed',
      metaMessageId: result.data?.messages?.[0]?.id,
      sentBy: 'system'
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    const io = req.app.get('io');
    if (io) {
      const rawOek = await getOekForUser(userId);
      io.to(`user_${userId}`).emit('new_message', {
        message: decryptMessage(savedMsg, rawOek),
        contact: contact.toObject(),
        conversationId: conversation._id
      });
    }
  } catch (err) {
    console.error('Failed to send WhatsApp update:', err.message);
  }
}

// Helper: Notify admins and managers about order events
async function notifyStoreAdmins(req, title, message, orderId) {
  try {
    const admins = await User.find({
      organizationId: req.organizationId,
      isDeleted: false,
      role: { $in: ['admin', 'owner', 'superadmin'] }
    }).select('_id');

    for (const admin of admins) {
      await createNotification({
        userId: admin._id,
        organizationId: req.organizationId,
        type: 'order',
        title,
        message,
        link: '/dashboard/catalog',
        metadata: { orderId: orderId.toString() }
      });
    }

    const io = req.app.get('io');
    if (io) {
      admins.forEach(admin => {
        io.to(`user_${admin._id}`).emit('order_notification', {
          title,
          message,
          orderId
        });
      });
    }
  } catch (err) {
    console.error('Failed to dispatch admin notification:', err.message);
  }
}

// GET /orders — List orders
router.get('/', async (req, res) => {
  try {
    const { status, contactId, page = 1, limit = 20, search = '' } = req.query;
    const query = { organizationId: req.organizationId };

    if (status) query.status = status;
    if (contactId && mongoose.Types.ObjectId.isValid(contactId)) query.contactId = contactId;

    if (search.trim()) {
      query.$or = [
        { orderNumber: new RegExp(search.trim(), 'i') },
        { customerName: new RegExp(search.trim(), 'i') },
        { phoneNumber: new RegExp(search.trim(), 'i') }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('contactId', 'name phone email')
        .populate('assignedTo', 'name email role avatar')
        .populate('createdBy', 'name email')
        .lean(),
      Order.countDocuments(query)
    ]);

    // Populate order items, payment submissions, and status history log lists in bulk
    const orderIds = orders.map(o => o._id);
    const [orderItems, submissions, historyLogs] = await Promise.all([
      OrderItem.find({ orderId: { $in: orderIds } }).populate('productId', 'name price discountPrice sku').lean(),
      PaymentSubmission.find({ orderId: { $in: orderIds } }).populate('verifiedBy', 'name email').sort({ createdAt: -1 }).lean(),
      OrderStatusHistory.find({ orderId: { $in: orderIds } }).populate('changedBy', 'name email').sort({ createdAt: 1 }).lean()
    ]);

    const itemsByOrder = {};
    orderItems.forEach(item => {
      if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
      itemsByOrder[item.orderId].push(item);
    });

    const submissionsByOrder = {};
    submissions.forEach(sub => {
      if (!submissionsByOrder[sub.orderId]) submissionsByOrder[sub.orderId] = [];
      submissionsByOrder[sub.orderId].push(sub);
    });

    const historyByOrder = {};
    historyLogs.forEach(log => {
      if (!historyByOrder[log.orderId]) historyByOrder[log.orderId] = [];
      historyByOrder[log.orderId].push(log);
    });

    orders.forEach(o => {
      o.items = itemsByOrder[o._id] || [];
      o.paymentSubmissions = submissionsByOrder[o._id] || [];
      o.statusHistory = historyByOrder[o._id] || [];
    });

    res.json({
      success: true,
      data: {
        orders,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch orders', details: error.message });
  }
});

// GET /orders/:id — Retrieve order details
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate('contactId', 'name phone email')
      .populate('assignedTo', 'name email role avatar')
      .populate('createdBy', 'name email')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const [items, paymentSubmissions, statusHistory] = await Promise.all([
      OrderItem.find({ orderId: order._id }).populate('productId', 'name price discountPrice sku quantity').lean(),
      PaymentSubmission.find({ orderId: order._id }).populate('verifiedBy', 'name email').sort({ createdAt: -1 }).lean(),
      OrderStatusHistory.find({ orderId: order._id }).populate('changedBy', 'name email').sort({ createdAt: 1 }).lean()
    ]);

    order.items = items;
    order.paymentSubmissions = paymentSubmissions;
    order.statusHistory = statusHistory;

    res.json({ success: true, data: { order } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch order details', details: error.message });
  }
});

// POST /orders/:id/verify-payment — Admin approves/rejects payment details
router.post('/:id/verify-payment', ...validateObjectId('id'), async (req, res) => {
  try {
    const { action, rejectionReason } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Valid action (approve or reject) is required' });
    }

    const order = await Order.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Find the latest pending payment submission
    const submission = await PaymentSubmission.findOne({ orderId: order._id, status: 'pending' }).sort({ createdAt: -1 });
    if (!submission) {
      return res.status(400).json({ success: false, error: 'No pending payment submission found for this order' });
    }

    if (action === 'approve') {
      submission.status = 'approved';
      submission.verifiedBy = req.user._id;
      submission.verifiedAt = new Date();
      await submission.save();

      order.status = 'Payment Verified';
      await order.save();

      await OrderStatusHistory.create({
        orderId: order._id,
        status: 'Payment Verified',
        notes: `Payment approved by ${req.user.name || 'Admin'}`,
        changedBy: req.user._id
      });

      // Send auto-WhatsApp message
      await sendWhatsAppUpdate(req, order, `Payment verified successfully. Your order has been confirmed.`);
      
      // Notify Store Admins about payment verification
      await notifyStoreAdmins(req, 'Payment Verified ✅', `Payment for Order #${order.orderNumber} (₹${order.totalAmount}) has been verified successfully.`, order._id);
    } else {
      const reason = rejectionReason || 'Information mismatch';
      submission.status = 'rejected';
      submission.rejectionReason = reason;
      submission.verifiedBy = req.user._id;
      submission.verifiedAt = new Date();
      await submission.save();

      order.status = 'Pending Payment';
      await order.save();

      await OrderStatusHistory.create({
        orderId: order._id,
        status: 'Pending Payment',
        notes: `Payment verification rejected: ${reason}`,
        changedBy: req.user._id
      });

      // Send rejection and dynamic QR again
      const upiLink = `upi://pay?pa=hkdigiverse@oksbi&pn=HKDigiverse&am=${order.totalAmount.toFixed(2)}&tn=${order.orderNumber}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
      
      const rejectText = `We were unable to verify your payment. Reason: ${reason}.\n\nPlease scan the QR code below again to complete your payment of *₹${order.totalAmount.toFixed(2)}*:`;
      await sendWhatsAppUpdate(req, order, rejectText, qrCodeUrl);
      
      const instruction = `Once paid, please reply with your *12-digit UPI Transaction ID (UTR)* OR upload a *Screenshot* of the payment receipt.`;
      await sendWhatsAppUpdate(req, order, instruction);
      
      // Notify Store Admins
      await notifyStoreAdmins(req, 'Payment Rejected ❌', `Payment for Order #${order.orderNumber} (₹${order.totalAmount}) was rejected.`, order._id);
    }

    res.json({ success: true, message: `Payment submission successfully ${action}d` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Payment verification failed', details: error.message });
  }
});

// POST /orders/:id/status — Admin transitions delivery status
router.post('/:id/status', ...validateObjectId('id'), async (req, res) => {
  try {
    const { status, trackingDetails, notes } = req.body;
    const allowedStatuses = ['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid delivery status value' });
    }

    const order = await Order.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const oldStatus = order.status;
    if (oldStatus === status) {
      return res.status(400).json({ success: false, error: `Order is already in status: ${status}` });
    }

    // Set status
    order.status = status;
    await order.save();

    // Log status history
    await OrderStatusHistory.create({
      orderId: order._id,
      status,
      notes: notes || `Order status updated to ${status}`,
      changedBy: req.user._id
    });

    // Handle inventory stock restoration on Cancellation
    if (status === 'Cancelled') {
      const items = await OrderItem.find({ orderId: order._id });
      for (const item of items) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { quantity: item.quantity } }
        );
      }
    }

    // Trigger WhatsApp update
    let waText = '';
    switch (status) {
      case 'Confirmed':
        waText = `Your order #${order.orderNumber} has been confirmed. Thank you!`;
        break;
      case 'Processing':
        waText = `Your order #${order.orderNumber} is now being processed.`;
        break;
      case 'Shipped':
        waText = `Your order #${order.orderNumber} has been shipped.${trackingDetails ? `\nTracking details: ${trackingDetails}` : ''}`;
        break;
      case 'Delivered':
        waText = `Your order #${order.orderNumber} has been delivered successfully. Thank you for shopping with us.`;
        break;
      case 'Cancelled':
        waText = `Your order #${order.orderNumber} has been cancelled.`;
        break;
    }

    if (waText) {
      await sendWhatsAppUpdate(req, order, waText);
    }

    // Dispatch admin notification
    await notifyStoreAdmins(req, `Order Status Updated: ${status}`, `Order #${order.orderNumber} is now ${status}.`, order._id);

    res.json({ success: true, message: `Order status successfully transitioned to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Status transition failed', details: error.message });
  }
});

// GET /orders/customer/:customerId/history — Retrieve customer purchase metrics and list
router.get('/customer/:customerId/history', ...validateObjectId('customerId'), async (req, res) => {
  try {
    const { customerId } = req.params;

    // Check contact exists
    const contact = await Contact.findOne({ _id: customerId, userId: req.userId });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Customer contact not found' });
    }

    const orders = await Order.find({ contactId: customerId, organizationId: req.organizationId }).sort({ createdAt: -1 }).lean();

    const totalOrders = orders.length;
    let lifetimeValue = 0;
    orders.forEach(o => {
      if (o.status !== 'Cancelled') {
        lifetimeValue += o.totalAmount;
      }
    });

    const lastOrder = orders.length > 0 ? orders[0] : null;

    res.json({
      success: true,
      data: {
        totalOrders,
        lifetimeValue: parseFloat(lifetimeValue.toFixed(2)),
        lastOrder,
        history: orders
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch customer history', details: error.message });
  }
});

module.exports = router;
