const router = require('express').Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Contact = require('../models/Contact');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const { createNotification } = require('../services/notificationService');

router.use(verifyToken);

// GET /orders — List orders
router.get('/', async (req, res) => {
  try {
    const { status, contactId, assignedTo, page = 1, limit = 20 } = req.query;
    const query = { organizationId: req.organizationId };

    if (status) query.status = status;
    if (contactId && mongoose.Types.ObjectId.isValid(contactId)) query.contactId = contactId;
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) query.assignedTo = assignedTo;

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

// POST /orders — Create order
router.post('/', async (req, res) => {
  try {
    const { orderNumber, contactId, assignedTo, totalAmount } = req.body;
    if (!orderNumber || !contactId || !assignedTo || totalAmount === undefined) {
      return res.status(400).json({ success: false, error: 'OrderNumber, contactId, assignedTo, and totalAmount are required' });
    }

    // Verify contact belongs to organization
    const contact = await Contact.findOne({ _id: contactId, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    // Verify assignee belongs to organization
    const agent = await User.findOne({ _id: assignedTo, organizationId: req.organizationId, isDeleted: { $ne: true } });
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Assigned user not found' });
    }

    // Check unique orderNumber
    const existing = await Order.findOne({ orderNumber: orderNumber.trim() });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Order number already exists' });
    }

    const order = await Order.create({
      organizationId: req.organizationId,
      orderNumber: orderNumber.trim(),
      contactId,
      assignedTo,
      totalAmount,
      status: 'created',
      createdBy: req.user._id
    });

    // Notify assignee
    if (assignedTo.toString() !== req.user._id.toString()) {
      await createNotification({
        userId: assignedTo,
        organizationId: req.organizationId,
        type: 'order',
        title: 'New Order Created 📦',
        message: `Order #${orderNumber} (₹${totalAmount}) has been created for ${contact.name || contact.phone}.`,
        link: '/dashboard/contacts',
        metadata: { orderId: order._id }
      });
    }

    res.status(201).json({ success: true, data: { order }, message: 'Order created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create order', details: error.message });
  }
});

// PUT /orders/:id — Update order details (status)
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { status, totalAmount } = req.body;
    const order = await Order.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const oldStatus = order.status;

    if (totalAmount !== undefined) order.totalAmount = totalAmount;
    if (status !== undefined) {
      const validStatuses = ['created', 'confirmed', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      order.status = status;
    }

    await order.save();

    // Trigger status transition notification
    if (status !== undefined && status !== oldStatus) {
      let titleText = 'Order Updated 📦';
      let msgText = `Order #${order.orderNumber} status changed to ${status}.`;

      switch (status) {
        case 'confirmed':
          titleText = 'Order Confirmed ✅';
          msgText = `Order #${order.orderNumber} has been confirmed.`;
          break;
        case 'shipped':
          titleText = 'Order Shipped 🚚';
          msgText = `Order #${order.orderNumber} has been shipped.`;
          break;
        case 'delivered':
          titleText = 'Order Delivered 🎉';
          msgText = `Order #${order.orderNumber} has been delivered successfully.`;
          break;
        case 'cancelled':
          titleText = 'Order Cancelled ❌';
          msgText = `Order #${order.orderNumber} has been cancelled.`;
          break;
      }

      await createNotification({
        userId: order.assignedTo,
        organizationId: req.organizationId,
        type: 'order',
        title: titleText,
        message: msgText,
        link: '/dashboard/contacts',
        metadata: { orderId: order._id }
      });
    }

    res.json({ success: true, data: { order }, message: 'Order updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update order', details: error.message });
  }
});

// DELETE /orders/:id — Delete order
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const order = await Order.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete order', details: error.message });
  }
});

module.exports = router;
