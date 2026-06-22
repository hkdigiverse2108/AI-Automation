const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const Contact = require('../models/Contact');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const PaymentSubmission = require('../models/PaymentSubmission');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const conversationModel = require('../models/Conversation');
const commerceEngine = require('../services/commerceEngine');
const whatsapp = require('../services/whatsapp');

// Mock whatsapp responses to verify api integrations without hitting Facebook servers
const originalSendTextMessage = whatsapp.sendTextMessage;
const originalSendImageMessage = whatsapp.sendImageMessage;
const originalSendListMessage = whatsapp.sendListMessage;
const originalSendButtonMessage = whatsapp.sendButtonMessage;

let sentMessages = [];
whatsapp.sendTextMessage = async (phoneNumberId, token, to, text) => {
  sentMessages.push({ type: 'text', to, text });
  return { success: true, data: { messages: [{ id: 'mock_wamid_' + Date.now() }] } };
};

whatsapp.sendImageMessage = async (phoneNumberId, token, to, imageUrl, caption) => {
  sentMessages.push({ type: 'image', to, imageUrl, caption });
  return { success: true, sentUrl: imageUrl, data: { messages: [{ id: 'mock_wamid_' + Date.now() }] } };
};

whatsapp.sendListMessage = async (phoneNumberId, token, to, bodyText, sections, buttonText, title) => {
  sentMessages.push({ type: 'list', to, bodyText, sections });
  return { success: true, data: { messages: [{ id: 'mock_wamid_' + Date.now() }] } };
};

whatsapp.sendButtonMessage = async (phoneNumberId, token, to, bodyText, buttons) => {
  sentMessages.push({ type: 'button', to, bodyText, buttons });
  return { success: true, data: { messages: [{ id: 'mock_wamid_' + Date.now() }] } };
};

async function runTests() {
  console.log('--- STARTING WHATSAPP COMMERCE MODULE INTEGRATION TESTS ---');
  await connectDB();

  let org, user, contact, category, product, conversation;

  try {
    // 1. Clear database test items
    const lingeringContacts = await Contact.find({ phone: '919876543210' }).select('_id');
    const lingeringContactIds = lingeringContacts.map(c => c._id);
    const lingeringOrders = await Order.find({ 
      $or: [
        { contactId: { $in: lingeringContactIds } },
        { orderNumber: /^HKD-/ }
      ]
    }).select('_id');
    const lingeringOrderIds = lingeringOrders.map(o => o._id);
    
    await OrderItem.deleteMany({ orderId: { $in: lingeringOrderIds } });
    await PaymentSubmission.deleteMany({ orderId: { $in: lingeringOrderIds } });
    await OrderStatusHistory.deleteMany({ orderId: { $in: lingeringOrderIds } });
    await Order.deleteMany({ _id: { $in: lingeringOrderIds } });

    const lingeringCarts = await Cart.find({ customerId: { $in: lingeringContactIds } }).select('_id');
    const lingeringCartIds = lingeringCarts.map(c => c._id);
    await CartItem.deleteMany({ cartId: { $in: lingeringCartIds } });
    await Cart.deleteMany({ customerId: { $in: lingeringContactIds } });

    await Organization.deleteMany({ name: 'Test Commerce Org' });
    await User.deleteMany({ email: 'commerce_admin@test.com' });
    await Category.deleteMany({ name: 'Test Electronics' });
    await Contact.deleteMany({ phone: '919876543210' });
    await WhatsAppAccount.deleteMany({ phoneNumberId: '123456789' });

    // 2. Set up tenant organization and admin
    org = await Organization.create({
      name: 'Test Commerce Org',
      contactEmail: 'commerce_admin@test.com',
      subscriptionStatus: 'active',
      maxMonthlyConversations: 1000
    });

    user = await User.create({
      name: 'Commerce Admin',
      email: 'commerce_admin@test.com',
      passwordHash: 'password123_hash',
      role: 'admin',
      organizationId: org._id
    });

    // Create WhatsApp WABA account for the user/organization
    const { encryptField } = require('../services/encryption');
    await WhatsAppAccount.create({
      userId: user._id,
      phoneNumber: '919876543210',
      phoneNumberId: '123456789',
      wabaId: 'waba123',
      accessToken: encryptField('mock_access_token'),
      isActive: true
    });

    // Create Contact
    contact = await Contact.create({
      userId: user._id,
      phone: '919876543210',
      name: 'Customer test',
      source: 'direct'
    });

    // Create Conversation
    conversation = await conversationModel.create({
      userId: user._id,
      contactId: contact._id,
      status: 'bot',
      organization_id: org._id
    });

    // Create Catalog category & product
    category = await Category.create({
      organizationId: org._id,
      userId: user._id,
      name: 'Test Electronics',
      createdBy: user._id
    });

    product = await Product.create({
      organizationId: org._id,
      userId: user._id,
      categoryId: category._id,
      name: 'iPhone 15 Pro',
      description: 'Superb Apple smartphone',
      price: 100000,
      discountPrice: 95000,
      quantity: 10,
      lowStockThreshold: 2,
      status: 'in_stock',
      createdBy: user._id
    });

    const ProductImage = require('../models/ProductImage');
    await ProductImage.create({
      productId: product._id,
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800',
      isPrimary: true
    });

    console.log('✅ Baseline DB Setup Completed successfully.');

    // 3. Test 1: Handle keyword trigger "catalog"
    sentMessages = [];
    const savedMsg1 = { type: 'text', content: { text: 'catalog' } };
    let handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg1, '123456789', 'mock_token', null);
    
    if (!handled || sentMessages.length === 0 || sentMessages[0].type !== 'list') {
      throw new Error('Test 1 failed: commerceEngine did not display category list.');
    }
    console.log('✅ Test 1: Category list rendered successfully via "catalog" keyword.');

    // Test 2: Handle Category Selection
    sentMessages = [];
    const savedMsg2 = { type: 'text', content: { text: `cat_${category._id}` } };
    handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg2, '123456789', 'mock_token', null);
    
    if (!handled || sentMessages.length === 0 || sentMessages[0].type !== 'list') {
      throw new Error('Test 2 failed: commerceEngine did not show products list.');
    }
    console.log('✅ Test 2: Product list in category rendered successfully.');

    // Test 3: Handle Product Selection details
    sentMessages = [];
    const savedMsg3 = { type: 'text', content: { text: `prod_${product._id}` } };
    handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg3, '123456789', 'mock_token', null);
    
    if (!handled || sentMessages.length < 2 || sentMessages[0].type !== 'image' || sentMessages[1].type !== 'button') {
      throw new Error('Test 3 failed: Product details and actions buttons not rendered.');
    }
    console.log('✅ Test 3: Product details card and buttons rendered successfully.');

    // Test 4: Add to Cart
    sentMessages = [];
    const savedMsg4 = { type: 'text', content: { text: `add_to_cart_${product._id}` } };
    handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg4, '123456789', 'mock_token', null);

    const activeCart = await Cart.findOne({ customerId: contact._id, status: 'active' });
    const cartItem = activeCart ? await CartItem.findOne({ cartId: activeCart._id, productId: product._id }) : null;

    if (!cartItem || cartItem.quantity !== 1) {
      throw new Error('Test 4 failed: Product item not added to database cart.');
    }
    console.log('✅ Test 4: Product successfully accumulated in database Cart.');

    // Test 5: Checkout initialization
    sentMessages = [];
    const savedMsg5 = { type: 'text', content: { text: 'checkout' } };
    handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg5, '123456789', 'mock_token', null);
    
    if (!handled || conversation.flowVariables.get('commerce_state') !== 'checkout_waiting_name') {
      throw new Error('Test 5 failed: Did not transition to checkout_waiting_name state.');
    }
    console.log('✅ Test 5: Checkout wizard initiated, prompting for full name.');

    // Test 6: Fill checkout customerName
    sentMessages = [];
    const savedMsg6 = { type: 'text', content: { text: 'John Doe' } };
    handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg6, '123456789', 'mock_token', null);
    
    if (conversation.flowVariables.get('checkout_name') !== 'John Doe' || conversation.flowVariables.get('commerce_state') !== 'checkout_waiting_address') {
      throw new Error('Test 6 failed: Did not save customer name or transition to checkout_waiting_address.');
    }
    console.log('✅ Test 6: Checkout name recorded, prompting for delivery address.');

    // Test 7: Fill checkout Address
    sentMessages = [];
    const savedMsg7 = { type: 'text', content: { text: '123 Main St, NY' } };
    handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg7, '123456789', 'mock_token', null);
    
    if (conversation.flowVariables.get('checkout_address') !== '123 Main St, NY' || conversation.flowVariables.get('commerce_state') !== 'checkout_waiting_notes') {
      throw new Error('Test 7 failed: Did not save address or transition to checkout_waiting_notes.');
    }
    console.log('✅ Test 7: Checkout address recorded, prompting for notes.');

    // Test 8: Fill checkout Notes
    sentMessages = [];
    const savedMsg8 = { type: 'text', content: { text: 'none' } };
    handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg8, '123456789', 'mock_token', null);
    
    if (conversation.flowVariables.get('commerce_state') !== 'checkout_confirm') {
      throw new Error('Test 8 failed: Did not transition to checkout_confirm state.');
    }
    console.log('✅ Test 8: Checkout notes recorded, rendering Order Confirmation Card.');

    // Test 9: Confirm Order placement
    sentMessages = [];
    const savedMsg9 = { type: 'text', content: { text: 'confirm_order' } };
    handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg9, '123456789', 'mock_token', null);

    const placedOrder = await Order.findOne({ contactId: contact._id }).sort({ createdAt: -1 });
    const orderItems = placedOrder ? await OrderItem.find({ orderId: placedOrder._id }) : [];
    
    if (!placedOrder || placedOrder.status !== 'Pending Payment' || !placedOrder.orderNumber.startsWith('HKD-')) {
      throw new Error('Test 9 failed: Order was not generated properly.');
    }
    if (orderItems.length !== 1 || orderItems[0].quantity !== 1) {
      throw new Error('Test 9 failed: Order items were not registered.');
    }
    
    // Verify stock is reduced
    const updatedProduct = await Product.findById(product._id);
    if (updatedProduct.quantity !== 9) {
      throw new Error(`Test 9 failed: Product stock did not deduct. Stock is: ${updatedProduct.quantity}`);
    }

    // Verify confirmation message has the UPI QR code link
    const confirmMessage = sentMessages.find(m => m.type === 'image');
    const decodedUrl = confirmMessage ? decodeURIComponent(confirmMessage.imageUrl) : '';
    if (!confirmMessage || !decodedUrl.includes('upi://pay') || !decodedUrl.includes('hkdigiverse@oksbi')) {
      throw new Error('Test 9 failed: Dynamic UPI QR code was not sent to user.');
    }

    console.log('✅ Test 9: Order created, stock deducted (10 -> 9), and dynamic UPI QR code generated.');

    // Test 10: Payment Submission (UTR submission)
    sentMessages = [];
    const savedMsg10 = { type: 'text', content: { text: '123456789012' } }; // 12-digit UTR
    handled = await commerceEngine.handleCommerceMessage(user._id, conversation, contact, savedMsg10, '123456789', 'mock_token', null);

    const submission = await PaymentSubmission.findOne({ orderId: placedOrder._id });
    const updatedOrder = await Order.findById(placedOrder._id);

    if (!submission || submission.utrNumber !== '123456789012' || submission.status !== 'pending') {
      throw new Error('Test 10 failed: PaymentSubmission was not created.');
    }
    if (updatedOrder.status !== 'Payment Submitted') {
      throw new Error(`Test 10 failed: Order status was not updated. Status: ${updatedOrder.status}`);
    }
    console.log('✅ Test 10: Payment submission (UTR 12-digit) accepted and transitioned order to Payment Submitted.');

    console.log('\nAll 10 integration test validation checkpoints passed successfully! 🚀');

  } catch (error) {
    console.error('❌ INTEGRATION TEST FAILED:', error);
    process.exit(1);
  } finally {
    // Restore originals
    whatsapp.sendTextMessage = originalSendTextMessage;
    whatsapp.sendImageMessage = originalSendImageMessage;
    whatsapp.sendListMessage = originalSendListMessage;
    whatsapp.sendButtonMessage = originalSendButtonMessage;

    // Disconnect DB
    await disconnectDB();
  }
}

runTests();
