const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const PaymentSubmission = require('../models/PaymentSubmission');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const Category = require('../models/Category');
const ProductImage = require('../models/ProductImage');
const Contact = require('../models/Contact');
const User = require('../models/User');
const whatsapp = require('./whatsapp');
const { createNotification } = require('./notificationService');
const { decryptField } = require('./encryption');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Main entry point: intercept message and run commerce state machine
 */
async function handleCommerceMessage(userId, conversation, contact, savedMsg, phoneNumberId, token, io) {
  try {
    const textVal = (savedMsg.content?.text || '').trim();
    const textLower = textVal.toLowerCase();
    const msgType = savedMsg.type;

    // Retrieve active commerce state
    let commerceState = conversation.flowVariables.get('commerce_state') || null;
    let inCommerce = conversation.flowVariables.get('in_commerce') === 'true';

    // Keywords to trigger catalog entry
    const isTriggerKeyword = ['catalog', 'menu', 'shop', 'buy', 'products', 'categories'].includes(textLower);
    const isCartKeyword = ['cart', 'view cart', 'checkout'].includes(textLower);

    // Check if message is commerce related
    const isCommerce = isTriggerKeyword || isCartKeyword || inCommerce || commerceState;
    if (!isCommerce) return false; // Hand over to normal bot flow

    logger.info(`[COMMERCE ENGINE] Processing message for ${contact.phone}. Current State: ${commerceState}`);

    // If checkout is requested or initial trigger is fired
    if (isTriggerKeyword || textLower === 'back' || textLower === 'exit') {
      if (textLower === 'exit') {
        // Exit commerce session
        conversation.flowVariables.set('commerce_state', null);
        conversation.flowVariables.set('in_commerce', 'false');
        await conversation.save();
        await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "You have exited the shop catalog. Type *Catalog* anytime to browse products again! 👋");
        return true;
      }
      // Render Category List
      await renderCategories(userId, conversation, contact, phoneNumberId, token);
      return true;
    }

    if (textLower === 'cart' || textLower === 'view cart') {
      await renderCart(userId, conversation, contact, phoneNumberId, token);
      return true;
    }

    if (textLower === 'clear cart' || textLower === 'empty cart') {
      await clearCartItems(userId, conversation, contact, phoneNumberId, token);
      return true;
    }

    if (textLower === 'checkout') {
      const cart = await Cart.findOne({ customerId: contact._id, organizationId: conversation.organization_id, status: 'active' });
      let itemsCount = 0;
      if (cart) {
        itemsCount = await CartItem.countDocuments({ cartId: cart._id });
      }
      if (itemsCount === 0) {
        await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Your shopping cart is empty! Please add products before checking out. 🛒");
        return true;
      }
      conversation.flowVariables.set('commerce_state', 'checkout_waiting_name');
      await conversation.save();
      await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Let's complete your order! Please enter your *Full Name* for delivery: 👤");
      return true;
    }

    // State machine branch processing
    if (commerceState === 'browsing_categories') {
      await handleCategorySelection(userId, conversation, contact, textVal, phoneNumberId, token);
    } else if (commerceState === 'browsing_products') {
      await handleProductSelection(userId, conversation, contact, textVal, phoneNumberId, token);
    } else if (commerceState === 'product_details') {
      await handleProductDetailsAction(userId, conversation, contact, textVal, phoneNumberId, token);
    } else if (commerceState === 'checkout_waiting_name') {
      await handleCheckoutName(userId, conversation, contact, textVal, phoneNumberId, token);
    } else if (commerceState === 'checkout_waiting_address') {
      await handleCheckoutAddress(userId, conversation, contact, textVal, phoneNumberId, token);
    } else if (commerceState === 'checkout_waiting_notes') {
      await handleCheckoutNotes(userId, conversation, contact, textVal, phoneNumberId, token);
    } else if (commerceState === 'checkout_confirm') {
      await handleCheckoutConfirm(userId, conversation, contact, textVal, phoneNumberId, token, io);
    } else if (commerceState === 'awaiting_payment') {
      await handlePaymentEvidence(userId, conversation, contact, savedMsg, phoneNumberId, token, io);
    } else {
      // Fallback
      await renderCategories(userId, conversation, contact, phoneNumberId, token);
    }

    return true;
  } catch (error) {
    logger.error('Error in handleCommerceMessage:', error);
    return false;
  }
}

// 1. Render Product Categories List
async function renderCategories(userId, conversation, contact, phoneNumberId, token) {
  const categories = await Category.find({ organizationId: conversation.organization_id }).lean();
  
  if (!categories || categories.length === 0) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Welcome to our shop! 🛍️\nNo product categories are configured currently. Please contact support.");
    return;
  }

  conversation.flowVariables.set('commerce_state', 'browsing_categories');
  conversation.flowVariables.set('in_commerce', 'true');
  await conversation.save();

  // Construct list sections
  const rows = categories.map(cat => ({
    id: `cat_${cat._id}`,
    title: cat.name.slice(0, 24),
    description: (cat.description || '').slice(0, 72)
  }));

  const sections = [{ title: "Categories Available", rows }];
  const bodyText = "Welcome to our Catalog! 🛍️\nPlease select a category to view our products:";
  
  const result = await whatsapp.sendListMessage(phoneNumberId, token, contact.phone, bodyText, sections, "Browse Shop", "Product Categories");
  if (!result.success) {
    // Fallback text message if list fails
    let text = `${bodyText}\n\n`;
    categories.forEach((cat, index) => {
      text += `*${index + 1}.* ${cat.name} ${cat.description ? `(${cat.description})` : ''}\n`;
    });
    text += "\nReply with the *category name* or *number* to browse products.";
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, text);
  }
}

// 2. Handle category selection
async function handleCategorySelection(userId, conversation, contact, textVal, phoneNumberId, token) {
  let selectedCategory = null;
  const categories = await Category.find({ organizationId: conversation.organization_id }).lean();

  if (textVal.startsWith('cat_')) {
    const catId = textVal.split('_')[1];
    selectedCategory = categories.find(c => c._id.toString() === catId);
  } else {
    // Parse by typing index or name match
    const index = parseInt(textVal, 10);
    if (!isNaN(index) && index >= 1 && index <= categories.length) {
      selectedCategory = categories[index - 1];
    } else {
      selectedCategory = categories.find(c => c.name.toLowerCase() === textVal.toLowerCase());
    }
  }

  if (!selectedCategory) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Invalid category selection. Please select one of the categories listed below: 👇");
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
    return;
  }

  // Find products in this category
  const products = await Product.find({
    categoryId: selectedCategory._id,
    organizationId: conversation.organization_id,
    isArchived: false
  }).lean();

  if (!products || products.length === 0) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, `No active products in category *${selectedCategory.name}*. Showing categories again...`);
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
    return;
  }

  conversation.flowVariables.set('commerce_state', 'browsing_products');
  conversation.flowVariables.set('selected_category_id', selectedCategory._id);
  await conversation.save();

  // Send products list message
  const rows = products.map(prod => ({
    id: `prod_${prod._id}`,
    title: prod.name.slice(0, 24),
    description: `₹${prod.discountPrice !== null ? prod.discountPrice : prod.price} - ${prod.status === 'in_stock' ? 'In Stock' : 'Out of stock'}`.slice(0, 72)
  }));

  const sections = [{ title: selectedCategory.name.slice(0, 24), rows }];
  const bodyText = `Browsing *${selectedCategory.name}*:\nSelect a product to view details:`;

  const result = await whatsapp.sendListMessage(phoneNumberId, token, contact.phone, bodyText, sections, "View Products", selectedCategory.name.slice(0, 20));
  if (!result.success) {
    let text = `${bodyText}\n\n`;
    products.forEach((prod, idx) => {
      text += `*${idx + 1}.* ${prod.name} (Price: ₹${prod.discountPrice !== null ? prod.discountPrice : prod.price})\n`;
    });
    text += "\nReply with the *product name* or *number* to see details.";
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, text);
  }
}

// 3. Handle product selection
async function handleProductSelection(userId, conversation, contact, textVal, phoneNumberId, token) {
  const catId = conversation.flowVariables.get('selected_category_id');
  const products = await Product.find({
    categoryId: catId,
    organizationId: conversation.organization_id,
    isArchived: false
  }).lean();

  let product = null;
  if (textVal.startsWith('prod_')) {
    const prodId = textVal.split('_')[1];
    product = products.find(p => p._id.toString() === prodId);
  } else {
    const index = parseInt(textVal, 10);
    if (!isNaN(index) && index >= 1 && index <= products.length) {
      product = products[index - 1];
    } else {
      product = products.find(p => p.name.toLowerCase() === textVal.toLowerCase());
    }
  }

  if (!product) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Product not found. Please choose from the list:");
    conversation.flowVariables.set('commerce_state', 'browsing_categories');
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
    return;
  }

  conversation.flowVariables.set('commerce_state', 'product_details');
  conversation.flowVariables.set('selected_product_id', product._id);
  await conversation.save();

  // Find images
  const primaryImage = await ProductImage.findOne({ productId: product._id, isPrimary: true }).lean() || await ProductImage.findOne({ productId: product._id }).lean();
  
  const finalPrice = product.discountPrice !== null ? product.discountPrice : product.price;
  const hasDiscount = product.discountPrice !== null;

  const caption = `*${product.name}*
${product.description || 'No description provided.'}

*Price:* ₹${product.price}${hasDiscount ? `\n*Discount price:* ₹${product.discountPrice}` : ''}
*Stock availability:* ${product.status === 'in_stock' ? '🟢 In Stock' : product.status === 'low_stock' ? '🟡 Low Stock' : '🔴 Out of Stock'}

Reply with:
- *1* or *Add to Cart* to add this to your basket.
- *Back* to return to the catalog categories list.`;

  if (primaryImage && primaryImage.imageUrl) {
    await whatsapp.sendImageMessage(phoneNumberId, token, contact.phone, primaryImage.imageUrl, caption);
  } else {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, caption);
  }

  // Send buttons for interaction
  const buttons = [
    { id: `add_to_cart_${product._id}`, title: "Add to Cart 🛒" },
    { id: "view_cart", title: "View Cart 🛍️" },
    { id: "back_catalog", title: "Back to Catalog 📁" }
  ];
  await whatsapp.sendButtonMessage(phoneNumberId, token, contact.phone, "Quick Actions:", buttons);
}

// 4. Handle actions on details page
async function handleProductDetailsAction(userId, conversation, contact, textVal, phoneNumberId, token) {
  const prodId = conversation.flowVariables.get('selected_product_id');
  const product = await Product.findOne({ _id: prodId, organizationId: conversation.organization_id });

  if (!product) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Product detail context expired. Back to categories.");
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
    return;
  }

  const isAddToCart = textVal.startsWith('add_to_cart_') || textVal === '1' || textVal.toLowerCase().includes('add to cart');
  const isBack = textVal === 'back_catalog' || textVal.toLowerCase() === 'back';
  const isCart = textVal === 'view_cart' || textVal.toLowerCase() === 'cart';

  if (isAddToCart) {
    // Add product to cart
    if (product.quantity <= 0) {
      await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, `Sorry, *${product.name}* is currently out of stock and cannot be added. 😔`);
      return;
    }

    let cart = await Cart.findOne({ organizationId: conversation.organization_id, customerId: contact._id, status: 'active' });
    if (!cart) {
      cart = await Cart.create({ organizationId: conversation.organization_id, customerId: contact._id, status: 'active' });
    }

    let cartItem = await CartItem.findOne({ cartId: cart._id, productId: product._id });
    const price = product.discountPrice !== null ? product.discountPrice : product.price;

    if (cartItem) {
      if (cartItem.quantity + 1 > product.quantity) {
        await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, `Only ${product.quantity} units of *${product.name}* in stock. Cannot add more.`);
        return;
      }
      cartItem.quantity += 1;
      cartItem.totalPrice = price * cartItem.quantity;
      await cartItem.save();
    } else {
      await CartItem.create({
        cartId: cart._id,
        productId: product._id,
        quantity: 1,
        unitPrice: price,
        totalPrice: price
      });
    }

    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, `🛒 Added *${product.name}* to cart!`);
    await renderCart(userId, conversation, contact, phoneNumberId, token);
  } else if (isBack) {
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
  } else if (isCart) {
    await renderCart(userId, conversation, contact, phoneNumberId, token);
  } else {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Please use the buttons provided or reply with *Add to Cart*, *Back*, or *Cart*.");
  }
}

// Helper: Calculate active cart totals
async function getCartSummaryText(customerId, organizationId) {
  const cart = await Cart.findOne({ customerId, organizationId, status: 'active' });
  if (!cart) return { text: "Your shopping cart is empty! 🛒", total: 0, items: [] };

  const items = await CartItem.find({ cartId: cart._id }).populate('productId').lean();
  if (!items || items.length === 0) return { text: "Your shopping cart is empty! 🛒", total: 0, items: [] };

  let subtotal = 0;
  let totalDiscount = 0;
  let summary = `🛒 *Your Shopping Cart*\n\n`;

  items.forEach((item, index) => {
    const product = item.productId;
    const basePrice = product.price;
    const finalPrice = item.unitPrice;
    const disc = basePrice - finalPrice;

    summary += `*${index + 1}. ${product.name}*\n`;
    summary += `Quantity: ${item.quantity} x ₹${finalPrice}\n`;
    summary += `Total: ₹${item.totalPrice}\n\n`;

    subtotal += basePrice * item.quantity;
    totalDiscount += disc * item.quantity;
  });

  const taxableAmount = subtotal - totalDiscount;
  const tax = parseFloat((taxableAmount * 0.18).toFixed(2));
  const grandTotal = parseFloat((taxableAmount + tax).toFixed(2));

  summary += `---------------------\n`;
  summary += `*Subtotal:* ₹${subtotal.toFixed(2)}\n`;
  if (totalDiscount > 0) summary += `*Discount:* -₹${totalDiscount.toFixed(2)}\n`;
  summary += `*GST (18%):* ₹${tax.toFixed(2)}\n`;
  summary += `*Grand Total:* *₹${grandTotal.toFixed(2)}*\n\n`;
  summary += `Reply with:\n- *Checkout* to place your order.\n- *Clear Cart* to empty the basket.\n- *Back* to add more products.`;

  return { text: summary, total: grandTotal, items };
}

// 5. Render Cart
async function renderCart(userId, conversation, contact, phoneNumberId, token) {
  const { text, total, items } = await getCartSummaryText(contact._id, conversation.organization_id);

  if (items.length === 0) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, text);
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
    return;
  }

  // Send buttons
  const buttons = [
    { id: "checkout", title: "Checkout 💳" },
    { id: "clear_cart", title: "Clear Cart 🧹" },
    { id: "back_catalog", title: "Add More 🛍️" }
  ];
  await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, text);
  await whatsapp.sendButtonMessage(phoneNumberId, token, contact.phone, "Actions:", buttons);
}

// 6. Clear Cart items
async function clearCartItems(userId, conversation, contact, phoneNumberId, token) {
  const cart = await Cart.findOne({ customerId: contact._id, organizationId: conversation.organization_id, status: 'active' });
  if (cart) {
    await CartItem.deleteMany({ cartId: cart._id });
  }
  await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Your shopping cart has been cleared. 🧹");
  await renderCategories(userId, conversation, contact, phoneNumberId, token);
}

// 7. Handle checkout trigger & collect name
async function handleCheckoutName(userId, conversation, contact, textVal, phoneNumberId, token) {
  if (!textVal.trim()) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Please enter your name:");
    return;
  }
  conversation.flowVariables.set('checkout_name', textVal.trim());
  conversation.flowVariables.set('commerce_state', 'checkout_waiting_address');
  await conversation.save();

  await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, `Perfect! Now please enter your *complete delivery address*: 🏡`);
}

// 8. Handle checkout address
async function handleCheckoutAddress(userId, conversation, contact, textVal, phoneNumberId, token) {
  if (!textVal.trim()) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Please enter a valid shipping address:");
    return;
  }
  conversation.flowVariables.set('checkout_address', textVal.trim());
  conversation.flowVariables.set('commerce_state', 'checkout_waiting_notes');
  await conversation.save();

  await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, `Any special instructions/notes for this order? (Or type *none*): 📝`);
}

// 9. Handle checkout notes
async function handleCheckoutNotes(userId, conversation, contact, textVal, phoneNumberId, token) {
  let notes = textVal.trim();
  if (notes.toLowerCase() === 'none') notes = '';

  conversation.flowVariables.set('checkout_notes', notes);
  conversation.flowVariables.set('commerce_state', 'checkout_confirm');
  await conversation.save();

  const name = conversation.flowVariables.get('checkout_name');
  const address = conversation.flowVariables.get('checkout_address');

  const { text: cartText, total } = await getCartSummaryText(contact._id, conversation.organization_id);

  const confirmMsg = `📋 *Order Checkout Review*

*Name:* ${name}
*Phone:* ${contact.phone}
*Shipping Address:* ${address}
${notes ? `*Delivery Notes:* ${notes}\n` : ''}
*Amount to Pay:* *₹${total.toFixed(2)}*

Do you want to confirm this order?`;

  const buttons = [
    { id: "confirm_order", title: "Confirm Order ✅" },
    { id: "cancel_checkout", title: "Cancel Checkout ❌" }
  ];

  await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, confirmMsg);
  await whatsapp.sendButtonMessage(phoneNumberId, token, contact.phone, "Choose:", buttons);
}

// 10. Process Order placement
async function handleCheckoutConfirm(userId, conversation, contact, textVal, phoneNumberId, token, io) {
  const textLower = textVal.toLowerCase();

  if (textLower === 'cancel_checkout' || textLower.includes('cancel')) {
    conversation.flowVariables.set('commerce_state', null);
    await conversation.save();
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Checkout cancelled. You can continue shopping!");
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
    return;
  }

  if (textLower !== 'confirm_order' && !textLower.includes('confirm')) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Please confirm order or cancel:");
    return;
  }

  // 1. Get Cart
  const cart = await Cart.findOne({ customerId: contact._id, organizationId: conversation.organization_id, status: 'active' });
  if (!cart) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Cart expired. Start shopping again.");
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
    return;
  }

  const items = await CartItem.find({ cartId: cart._id }).populate('productId').lean();
  if (!items || items.length === 0) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Your cart is empty. Start shopping again.");
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
    return;
  }

  // 2. Validate stock
  for (const item of items) {
    const product = await Product.findOne({ _id: item.productId, organizationId: conversation.organization_id });
    if (!product || product.isArchived) {
      await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, `Sorry, product *${item.productId?.name}* is no longer available.`);
      return;
    }
    if (item.quantity > product.quantity) {
      await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, `Sorry, stock mismatch for *${product.name}*. Only ${product.quantity} units available in stock. Please adjust cart quantity.`);
      return;
    }
  }

  // 3. Deduct stock & check low stock thresholds
  for (const item of items) {
    const product = await Product.findOne({ _id: item.productId, organizationId: conversation.organization_id });
    product.quantity -= item.quantity;
    await product.save();
  }

  // 4. Calculate total
  let subtotal = 0;
  let discount = 0;
  items.forEach(item => {
    subtotal += item.productId.price * item.quantity;
    discount += (item.productId.price - item.unitPrice) * item.quantity;
  });
  const taxable = subtotal - discount;
  const tax = parseFloat((taxable * 0.18).toFixed(2));
  const grandTotal = parseFloat((taxable + tax).toFixed(2));

  // 5. Generate Order Unique ID (HKD-1001)
  const orderCount = await Order.countDocuments({ organizationId: conversation.organization_id });
  const orderNumber = `HKD-${1000 + orderCount + 1}`;

  // Create Order
  const name = conversation.flowVariables.get('checkout_name');
  const address = conversation.flowVariables.get('checkout_address');
  const notes = conversation.flowVariables.get('checkout_notes');

  const order = await Order.create({
    organizationId: conversation.organization_id,
    orderNumber,
    contactId: contact._id,
    customerName: name,
    phoneNumber: contact.phone,
    address,
    notes,
    totalAmount: grandTotal,
    status: 'Pending Payment',
    assignedTo: contact.assignedAgent || null
  });

  // Create OrderItems
  for (const item of items) {
    await OrderItem.create({
      orderId: order._id,
      productId: item.productId._id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    });
  }

  // Create status log
  await OrderStatusHistory.create({
    orderId: order._id,
    status: 'Pending Payment',
    notes: 'Order placed by customer via WhatsApp'
  });

  // Mark cart as checked out
  cart.status = 'checked_out';
  await cart.save();

  // Clear state fields but lock awaiting_payment
  conversation.flowVariables.set('commerce_state', 'awaiting_payment');
  conversation.flowVariables.set('active_order_id', order._id);
  await conversation.save();

  // 6. Generate dynamic UPI deep link & QR code pointing to hkdigiverse@oksbi
  const upiLink = `upi://pay?pa=hkdigiverse@oksbi&pn=HKDigiverse&am=${grandTotal.toFixed(2)}&tn=${orderNumber}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;

  // Construct Order confirmation message
  let itemsSummary = '';
  items.forEach(item => {
    itemsSummary += `- ${item.productId.name} x ${item.quantity}\n`;
  });

  const confirmMsg = `Thank you for your order! 🙏

*Order ID:* #${orderNumber}

*Products purchased:*
${itemsSummary}
*Total amount:* *₹${grandTotal.toFixed(2)}*

Please complete the payment using the static UPI ID below:

*UPI ID:* hkdigiverse@oksbi

Scan the QR code below using GPay, PhonePe, Paytm, or BHIM:`;

  await whatsapp.sendImageMessage(phoneNumberId, token, contact.phone, qrCodeUrl, confirmMsg);
  
  // Ask for payment verification attachment / UTR
  const instruction = `Once paid, please reply with your *12-digit UPI Transaction ID (UTR)* OR upload a *Screenshot* of the payment receipt.`;
  await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, instruction);

  // Notify Store Administrators in real-time
  await notifyStoreAdmins(conversation.organization_id, {
    title: 'New Order Received 📦',
    message: `Order #${orderNumber} (₹${grandTotal}) placed by ${name}. Awaiting payment.`,
    orderId: order._id,
    io
  });
}

// 11. Handle payment submission evidence
async function handlePaymentEvidence(userId, conversation, contact, savedMsg, phoneNumberId, token, io) {
  const orderId = conversation.flowVariables.get('active_order_id');
  const order = await Order.findOne({ _id: orderId, organizationId: conversation.organization_id });

  if (!order) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Order context not found. Catalog restarted.");
    conversation.flowVariables.set('commerce_state', null);
    await conversation.save();
    await renderCategories(userId, conversation, contact, phoneNumberId, token);
    return;
  }

  let utr = null;
  let screenshot = null;

  if (savedMsg.type === 'text') {
    const textVal = (savedMsg.content?.text || '').trim();
    // Validate if it is 12 digits
    if (/^\d{12}$/.test(textVal)) {
      utr = textVal;
    }
  } else if (savedMsg.type === 'image' && savedMsg.content?.mediaUrl) {
    screenshot = savedMsg.content.mediaUrl;
  }

  if (!utr && !screenshot) {
    await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "Please submit a valid *12-digit numeric UPI Transaction ID (UTR)* or upload a *payment screenshot*.");
    return;
  }

  // Create PaymentSubmission
  const submission = await PaymentSubmission.create({
    orderId: order._id,
    utrNumber: utr,
    screenshotUrl: screenshot,
    status: 'pending'
  });

  // Update order status
  order.status = 'Payment Submitted';
  await order.save();

  // Log status history
  await OrderStatusHistory.create({
    orderId: order._id,
    status: 'Payment Submitted',
    notes: utr ? `UTR submitted: ${utr}` : 'Payment screenshot submitted'
  });

  // Clear commerce session flow variables
  conversation.flowVariables.set('commerce_state', null);
  conversation.flowVariables.set('in_commerce', 'false');
  conversation.flowVariables.set('active_order_id', null);
  await conversation.save();

  // Confirm to customer
  await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, "We have received your payment details. Our team is verifying the payment.");

  // Notify admins
  await notifyStoreAdmins(order.organizationId, {
    title: 'Payment Details Submitted 💳',
    message: `Payment submitted for Order #${order.orderNumber} (₹${order.totalAmount}). Check dashboard to verify.`,
    orderId: order._id,
    io
  });
}

// Helper: Notify admins and managers about order events
async function notifyStoreAdmins(organizationId, { title, message, orderId, io }) {
  try {
    const admins = await User.find({
      organizationId,
      isDeleted: false,
      role: { $in: ['admin', 'owner', 'superadmin'] }
    }).select('_id');

    for (const admin of admins) {
      await createNotification({
        userId: admin._id,
        organizationId,
        type: 'order',
        title,
        message,
        link: '/dashboard/catalog', // link to Catalog tab orders console
        metadata: { orderId: orderId.toString() }
      });
    }

    if (io) {
      // Emit socket notification to organization room or active admin sockets
      admins.forEach(admin => {
        io.to(`user_${admin._id}`).emit('order_notification', {
          title,
          message,
          orderId
        });
      });
    }
  } catch (err) {
    logger.error('Failed to notify store admins:', err);
  }
}

module.exports = {
  handleCommerceMessage,
  renderCategories
};
