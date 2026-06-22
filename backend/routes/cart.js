const router = require('express').Router();
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const Contact = require('../models/Contact');
const Order = require('../models/Order');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const { createNotification } = require('../services/notificationService');

router.use(verifyToken);

// Helper to determine if user has Admin or Manager privileges
function getUserPrivilege(user) {
  const privilege = user.role;
  const isManager = 
    (user.designation && /manager/i.test(user.designation)) || 
    (user.department && /manager/i.test(user.department));
  const isAdminOrManager = ['superadmin', 'owner', 'admin'].includes(privilege) || isManager;
  return { isAdminOrManager, isManager };
}

// Notify all Admins/Managers in organization about stock events
async function dispatchStockNotification(req, product, eventType) {
  try {
    const orgUsers = await User.find({ organizationId: req.organizationId, isDeleted: false });
    const title = eventType === 'out_of_stock' ? 'Out of Stock Alert 🚨' : 'Low Stock Alert ⚠️';
    const message = eventType === 'out_of_stock'
      ? `Product "${product.name}" has run out of stock.`
      : `Product "${product.name}" is low in stock (${product.quantity} left).`;

    for (const u of orgUsers) {
      const { isAdminOrManager } = getUserPrivilege(u);
      if (isAdminOrManager) {
        await createNotification({
          userId: u._id,
          organizationId: req.organizationId,
          type: 'system',
          title,
          message,
          link: '/dashboard/catalog',
          metadata: { productId: product._id, sku: product.sku }
        });
      }
    }
  } catch (err) {
    console.error('Failed to dispatch stock notification:', err.message);
  }
}

// Helper to get or create active cart for a customer
async function getOrCreateCart(organizationId, customerId) {
  let cart = await Cart.findOne({
    organizationId,
    customerId,
    status: 'active'
  });

  if (!cart) {
    cart = await Cart.create({
      organizationId,
      customerId,
      status: 'active'
    });
  }
  return cart;
}

// Helper to calculate cart totals dynamically
async function calculateCartTotals(cartId) {
  const items = await CartItem.find({ cartId }).populate({
    path: 'productId',
    select: 'name price discountPrice sku quantity status isArchived'
  }).lean();

  let subtotal = 0;
  let totalDiscount = 0;

  const formattedItems = items.map(item => {
    const product = item.productId || {};
    const originalPrice = product.price || 0;
    const discountPrice = product.discountPrice;
    
    const basePrice = discountPrice !== null && discountPrice !== undefined ? discountPrice : originalPrice;
    const itemSubtotal = originalPrice * item.quantity;
    const itemDiscount = discountPrice !== null && discountPrice !== undefined
      ? (originalPrice - discountPrice) * item.quantity
      : 0;

    subtotal += itemSubtotal;
    totalDiscount += itemDiscount;

    return {
      _id: item._id,
      productId: product._id,
      name: product.name,
      sku: product.sku,
      quantity: item.quantity,
      availableQuantity: product.quantity,
      unitPrice: basePrice,
      originalPrice,
      discountPrice,
      totalPrice: basePrice * item.quantity
    };
  });

  const taxableAmount = subtotal - totalDiscount;
  const tax = parseFloat((taxableAmount * 0.18).toFixed(2)); // 18% tax
  const grandTotal = parseFloat((taxableAmount + tax).toFixed(2));

  return {
    items: formattedItems,
    totals: {
      subtotal,
      discount: totalDiscount,
      taxableAmount,
      tax,
      grandTotal
    }
  };
}

// GET /api/cart — get active cart details for a customer
router.get('/', async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, error: 'Valid customerId is required' });
    }

    // Verify contact belongs to tenant
    const contact = await Contact.findOne({ _id: customerId, userId: req.userId });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const cart = await getOrCreateCart(req.organizationId, customerId);
    
    // Fetch product images separately to map primary image
    const data = await calculateCartTotals(cart._id);
    const productIds = data.items.map(i => i.productId);
    const primaryImages = await ProductImage.find({ productId: { $in: productIds }, isPrimary: true }).lean();

    const itemsWithImages = data.items.map(item => {
      const matchImage = primaryImages.find(img => img.productId.toString() === item.productId.toString());
      return {
        ...item,
        imageUrl: matchImage ? matchImage.imageUrl : ''
      };
    });

    res.json({
      success: true,
      data: {
        cartId: cart._id,
        customerId: cart.customerId,
        items: itemsWithImages,
        totals: data.totals
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch cart details', details: error.message });
  }
});

// POST /api/cart/add — add product to cart
router.post('/add', async (req, res) => {
  try {
    const { customerId, productId, quantity = 1 } = req.body;
    if (!customerId || !productId) {
      return res.status(400).json({ success: false, error: 'CustomerId and ProductId are required' });
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid quantity' });
    }

    // Verify contact belongs to tenant
    const contact = await Contact.findOne({ _id: customerId, userId: req.userId });
    if (!contact) return res.status(404).json({ success: false, error: 'Customer not found' });

    // Verify product belongs to tenant
    const product = await Product.findOne({ _id: productId, organizationId: req.organizationId, isArchived: false });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const cart = await getOrCreateCart(req.organizationId, customerId);

    // Verify available stock
    let cartItem = await CartItem.findOne({ cartId: cart._id, productId: product._id });
    const currentCartQty = cartItem ? cartItem.quantity : 0;
    const requestedQty = currentCartQty + qty;

    if (requestedQty > product.quantity) {
      return res.status(400).json({
        success: false,
        error: `Requested quantity exceeds available stock. Only ${product.quantity} unit(s) in stock.`
      });
    }

    const price = product.discountPrice !== null && product.discountPrice !== undefined
      ? product.discountPrice
      : product.price;

    if (cartItem) {
      cartItem.quantity = requestedQty;
      cartItem.unitPrice = price;
      cartItem.totalPrice = price * requestedQty;
      await cartItem.save();
    } else {
      cartItem = await CartItem.create({
        cartId: cart._id,
        productId: product._id,
        quantity: qty,
        unitPrice: price,
        totalPrice: price * qty
      });
    }

    const data = await calculateCartTotals(cart._id);
    res.json({ success: true, data, message: 'Product added to cart' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add item to cart', details: error.message });
  }
});

// POST /api/cart/update — update product quantity in cart
router.post('/update', async (req, res) => {
  try {
    const { customerId, productId, quantity } = req.body;
    if (!customerId || !productId || quantity === undefined) {
      return res.status(400).json({ success: false, error: 'CustomerId, ProductId and Quantity are required' });
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ success: false, error: 'Invalid quantity' });
    }

    // Verify contact
    const contact = await Contact.findOne({ _id: customerId, userId: req.userId });
    if (!contact) return res.status(404).json({ success: false, error: 'Customer not found' });

    // Verify product
    const product = await Product.findOne({ _id: productId, organizationId: req.organizationId });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const cart = await getOrCreateCart(req.organizationId, customerId);

    if (qty === 0) {
      // Remove item
      await CartItem.deleteOne({ cartId: cart._id, productId: product._id });
    } else {
      // Verify available stock
      if (qty > product.quantity) {
        return res.status(400).json({
          success: false,
          error: `Requested quantity exceeds available stock. Only ${product.quantity} unit(s) in stock.`
        });
      }

      const price = product.discountPrice !== null && product.discountPrice !== undefined
        ? product.discountPrice
        : product.price;

      await CartItem.updateOne(
        { cartId: cart._id, productId: product._id },
        {
          $set: {
            quantity: qty,
            unitPrice: price,
            totalPrice: price * qty
          }
        },
        { upsert: true }
      );
    }

    const data = await calculateCartTotals(cart._id);
    res.json({ success: true, data, message: 'Cart updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update cart', details: error.message });
  }
});

// POST /api/cart/remove — remove product from cart
router.post('/remove', async (req, res) => {
  try {
    const { customerId, productId } = req.body;
    if (!customerId || !productId) {
      return res.status(400).json({ success: false, error: 'CustomerId and ProductId are required' });
    }

    const contact = await Contact.findOne({ _id: customerId, userId: req.userId });
    if (!contact) return res.status(404).json({ success: false, error: 'Customer not found' });

    const cart = await getOrCreateCart(req.organizationId, customerId);
    await CartItem.deleteOne({ cartId: cart._id, productId });

    const data = await calculateCartTotals(cart._id);
    res.json({ success: true, data, message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove item', details: error.message });
  }
});

// POST /api/cart/clear — clear all items in cart
router.post('/clear', async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ success: false, error: 'CustomerId is required' });
    }

    const contact = await Contact.findOne({ _id: customerId, userId: req.userId });
    if (!contact) return res.status(404).json({ success: false, error: 'Customer not found' });

    const cart = await getOrCreateCart(req.organizationId, customerId);
    await CartItem.deleteMany({ cartId: cart._id });

    res.json({ success: true, message: 'Cart cleared successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to clear cart', details: error.message });
  }
});

// POST /api/cart/checkout — checkout active cart and generate Order
router.post('/checkout', async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ success: false, error: 'CustomerId is required' });
    }

    // Verify contact
    const contact = await Contact.findOne({ _id: customerId, userId: req.userId });
    if (!contact) return res.status(404).json({ success: false, error: 'Customer not found' });

    const cart = await Cart.findOne({
      organizationId: req.organizationId,
      customerId,
      status: 'active'
    });

    if (!cart) {
      return res.status(400).json({ success: false, error: 'No active cart found for this customer' });
    }

    const data = await calculateCartTotals(cart._id);
    if (data.items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot checkout an empty cart' });
    }

    // Double check stock availability for all items before checking out
    for (const item of data.items) {
      const product = await Product.findOne({ _id: item.productId, organizationId: req.organizationId });
      if (!product || product.isArchived) {
        return res.status(400).json({ success: false, error: `Product "${item.name}" is no longer available.` });
      }
      if (item.quantity > product.quantity) {
        return res.status(400).json({
          success: false,
          error: `Stock allocation failed. Product "${item.name}" only has ${product.quantity} unit(s) remaining, but cart requested ${item.quantity}.`
        });
      }
    }

    // Deduct stock for all items
    for (const item of data.items) {
      const product = await Product.findOne({ _id: item.productId, organizationId: req.organizationId });
      const oldQty = product.quantity;
      const oldThreshold = product.lowStockThreshold;

      product.quantity -= item.quantity;
      await product.save();

      // Trigger stock alerts if threshold crossed
      const isNowOut = product.quantity === 0;
      const wasOut = oldQty === 0;
      const isNowLow = product.quantity <= product.lowStockThreshold;
      const wasLow = oldQty <= oldThreshold;

      if (isNowOut && !wasOut) {
        await dispatchStockNotification(req, product, 'out_of_stock');
      } else if (isNowLow && !wasLow && !isNowOut) {
        await dispatchStockNotification(req, product, 'low_stock');
      }
    }

    // Generate unique orderNumber (HKD-1001 format)
    const orderCount = await Order.countDocuments({ organizationId: req.organizationId });
    const orderNumber = `HKD-${1000 + orderCount + 1}`;

    // Resolve Order Assingee (default to contact assignedAgent, else current user)
    const assignedTo = contact.assignedAgent || req.user._id;

    // Resolve checkout details from body
    const { customerName, phoneNumber, address = '', notes = '' } = req.body;

    // Create Order
    const order = await Order.create({
      organizationId: req.organizationId,
      orderNumber,
      contactId: customerId,
      customerName: customerName || contact.name || contact.phone,
      phoneNumber: phoneNumber || contact.phone,
      address,
      notes,
      assignedTo,
      totalAmount: data.totals.grandTotal,
      status: 'Pending Payment',
      createdBy: req.user._id
    });

    // Create OrderItems
    const OrderItem = require('../models/OrderItem');
    for (const item of data.items) {
      await OrderItem.create({
        orderId: order._id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      });
    }

    // Create OrderStatusHistory
    const OrderStatusHistory = require('../models/OrderStatusHistory');
    await OrderStatusHistory.create({
      orderId: order._id,
      status: 'Pending Payment',
      notes: 'Order created via console checkout',
      changedBy: req.user._id
    });

    // Mark cart as checked out
    cart.status = 'checked_out';
    await cart.save();

    // Trigger Notification for Order Assignment
    if (assignedTo.toString() !== req.user._id.toString()) {
      await createNotification({
        userId: assignedTo,
        organizationId: req.organizationId,
        type: 'order',
        title: 'New Order Created 📦',
        message: `Order #${orderNumber} (₹${data.totals.grandTotal}) has been created for ${contact.name || contact.phone}.`,
        link: '/dashboard/catalog',
        metadata: { orderId: order._id }
      });
    }

    // Send WhatsApp payment confirmation & QR Code
    try {
      const WhatsAppAccount = require('../models/WhatsAppAccount');
      const { decryptField } = require('../services/encryption');
      const whatsapp = require('../services/whatsapp');
      const Message = require('../models/Message');
      const Conversation = require('../models/Conversation');
      const { getOekForUser, decryptMessage } = require('../services/oekService');
      
      const waAccount = await WhatsAppAccount.findOne({ userId: req.userId, isActive: true });
      if (waAccount) {
        const token = decryptField(waAccount.accessToken);
        const phoneNumberId = waAccount.phoneNumberId;
        
        // Dynamic UPI Link & QR
        const upiLink = `upi://pay?pa=hkdigiverse@oksbi&pn=HKDigiverse&am=${data.totals.grandTotal.toFixed(2)}&tn=${orderNumber}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
        
        let itemsSummary = '';
        data.items.forEach(item => {
          itemsSummary += `- ${item.name} x ${item.quantity}\n`;
        });
        
        const confirmMsg = `Thank you for your order! 🙏

*Order ID:* #${orderNumber}

*Products purchased:*
${itemsSummary}
*Total amount:* *₹${data.totals.grandTotal.toFixed(2)}*

Please complete the payment using the static UPI ID below:

*UPI ID:* hkdigiverse@oksbi

Scan the QR code below using GPay, PhonePe, Paytm, or BHIM:`;

        // Send Image first (QR Code)
        const imgResult = await whatsapp.sendImageMessage(phoneNumberId, token, contact.phone, qrCodeUrl, confirmMsg);
        
        // Send follow-up text asking for UTR / Screenshot
        const instruction = `Once paid, please reply with your *12-digit UPI Transaction ID (UTR)* OR upload a *Screenshot* of the payment receipt.`;
        const txtResult = await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, instruction);
        
        // Save outbound message to DB and emit Socket.io
        let conversation = await Conversation.findOne({ userId: req.userId, contactId: contact._id });
        if (conversation) {
          const savedImgMsg = await Message.create({
            userId: req.userId,
            conversationId: conversation._id,
            contactId: contact._id,
            direction: 'outbound',
            type: 'image',
            content: { text: confirmMsg, mediaUrl: imgResult.sentUrl || qrCodeUrl },
            status: imgResult.success ? 'sent' : 'failed',
            metaMessageId: imgResult.data?.messages?.[0]?.id,
            sentBy: 'system'
          });
          
          const savedTxtMsg = await Message.create({
            userId: req.userId,
            conversationId: conversation._id,
            contactId: contact._id,
            direction: 'outbound',
            type: 'text',
            content: { text: instruction },
            status: txtResult.success ? 'sent' : 'failed',
            metaMessageId: txtResult.data?.messages?.[0]?.id,
            sentBy: 'system'
          });
          
          conversation.lastMessageAt = new Date();
          await conversation.save();
          
          const io = req.app.get('io');
          if (io) {
            const rawOek = await getOekForUser(req.userId);
            io.to(`user_${req.userId}`).emit('new_message', {
              message: decryptMessage(savedImgMsg, rawOek),
              contact: contact.toObject(),
              conversationId: conversation._id
            });
            io.to(`user_${req.userId}`).emit('new_message', {
              message: decryptMessage(savedTxtMsg, rawOek),
              contact: contact.toObject(),
              conversationId: conversation._id
            });
          }
        }
      }
    } catch (waErr) {
      console.error('Failed to send WhatsApp payment notification on console checkout:', waErr.message);
    }

    res.status(201).json({
      success: true,
      data: { order },
      message: 'Cart checked out successfully and order generated'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Checkout failed', details: error.message });
  }
});

module.exports = router;
