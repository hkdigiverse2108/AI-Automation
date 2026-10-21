const Invoice = require('../models/Invoice');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const whatsapp = require('./whatsapp');
const { decryptField } = require('./encryption');
const { createNotification } = require('./notificationService');
const { getIO } = require('./socketService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Format a Date object to DD/MM/YYYY
 */
function formatDate(date) {
  if (!date) return new Date().toLocaleDateString('en-GB');
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-GB');
  return d.toLocaleDateString('en-GB'); // Formats as DD/MM/YYYY
}

/**
 * Format phone number to E.164 without plus (e.g. 919876543210)
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Find active WhatsApp account for an invoice (userId, org owner, or fallback)
 */
async function getWhatsAppAccountForInvoice(invoice) {
  let waAccount = await WhatsAppAccount.findOne({
    userId: invoice.userId,
    isActive: true,
  });

  if (!waAccount && invoice.organizationId) {
    const owner = await User.findOne({ organizationId: invoice.organizationId, role: 'owner' });
    if (owner) {
      waAccount = await WhatsAppAccount.findOne({ userId: owner._id, isActive: true });
    }
  }

  if (!waAccount) {
    waAccount = await WhatsAppAccount.findOne({ isActive: true });
  }

  return waAccount;
}

/**
 * Record outbound template message in chat history & emit via socket
 */
async function recordOutboundMessage({ waAccount, invoice, templateName, variables, metaResult, fallbackText }) {
  try {
    const phone = formatPhoneNumber(invoice.customerPhone);
    if (!phone) return;

    // Find or create Contact
    let contact = null;
    if (invoice.customerId) {
      contact = await Contact.findById(invoice.customerId);
    }
    if (!contact) {
      contact = await Contact.findOne({
        userId: waAccount.userId,
        phone: { $in: [phone, invoice.customerPhone] }
      });
    }

    const contactId = contact ? contact._id : invoice.customerId;

    // Find or create Conversation
    let conversation = null;
    if (contactId) {
      conversation = await Conversation.findOne({ userId: waAccount.userId, contactId });
      if (!conversation) {
        conversation = await Conversation.create({
          userId: waAccount.userId,
          contactId,
          status: 'human',
          source: 'invoice_automation',
          organization_id: invoice.organizationId || waAccount.organizationId,
        });
      }
    }

    const message = await Message.create({
      userId: waAccount.userId,
      conversationId: conversation ? conversation._id : null,
      contactId: contactId || null,
      direction: 'outbound',
      type: 'template',
      content: {
        text: fallbackText,
        templateName,
        templateVariables: variables
      },
      status: metaResult?.success ? 'sent' : 'failed',
      metaMessageId: metaResult?.data?.messages?.[0]?.id,
      sentBy: 'system',
      errorDetails: metaResult?.error,
    });

    if (conversation) {
      conversation.lastMessageAt = new Date();
      await conversation.save();
    }

    // Emit live update via Socket.IO
    const io = getIO();
    if (io && conversation) {
      io.to(waAccount.userId.toString()).emit('new_message', {
        message,
        conversationId: conversation._id
      });
    }
  } catch (err) {
    logger.error('[InvoiceAutomation] Error recording outbound message:', err.message);
  }
}

/**
 * 1. Send Payment Reminder WhatsApp Template (2 days before due date)
 * Template: payment_reminder (Utility, en)
 * Variables:
 * {{1}}: Customer Name
 * {{2}}: Amount
 * {{3}}: Service / Item description
 * {{4}}: Invoice Number
 * {{5}}: Due Date (DD/MM/YYYY)
 */
async function sendInvoicePaymentReminder(invoice, options = { manual: false }) {
  try {
    if (!options.manual && invoice.reminderSent) {
      return { success: false, reason: 'Reminder already sent' };
    }

    const phone = formatPhoneNumber(invoice.customerPhone);
    if (!phone) {
      return { success: false, reason: 'Customer phone number missing or invalid' };
    }

    const waAccount = await getWhatsAppAccountForInvoice(invoice);
    if (!waAccount) {
      return { success: false, reason: 'No active WhatsApp account configured' };
    }

    const token = decryptField(waAccount.accessToken);
    const serviceName = (invoice.items && invoice.items[0]?.description) || 'Services';
    const dueDateStr = formatDate(invoice.dueDate);
    const amountStr = String(invoice.grandTotal || 0);

    const variables = [
      invoice.customerName || 'Customer',
      amountStr,
      serviceName,
      invoice.invoiceNumber,
      dueDateStr
    ];

    const templateComponents = [
      {
        type: 'body',
        parameters: variables.map(val => ({ type: 'text', text: String(val) }))
      }
    ];

    logger.info(`[InvoiceAutomation] Sending payment_reminder for invoice ${invoice.invoiceNumber} to ${phone}`);

    const result = await whatsapp.sendTemplateMessage(
      waAccount.phoneNumberId,
      token,
      phone,
      'payment_reminder',
      'en',
      templateComponents
    );

    const fallbackText = `Payment Reminder: Hello ${invoice.customerName || 'Customer'}, your payment of Rs. ${amountStr} for ${serviceName} (Invoice No. ${invoice.invoiceNumber}) is due on ${dueDateStr}.`;

    await recordOutboundMessage({
      waAccount,
      invoice,
      templateName: 'payment_reminder',
      variables,
      metaResult: result,
      fallbackText
    });

    if (result.success) {
      await Invoice.findByIdAndUpdate(invoice._id, {
        reminderSent: true,
        reminderSentAt: new Date()
      });

      await createNotification({
        userId: invoice.userId,
        organizationId: invoice.organizationId,
        type: 'message',
        title: `Payment Reminder Sent 🔔`,
        message: `WhatsApp payment reminder sent to ${invoice.customerName} for Invoice #${invoice.invoiceNumber} (₹${amountStr}).`,
        link: '/dashboard/invoice-settings?tab=history'
      });

      return { success: true, messageId: result.data?.messages?.[0]?.id };
    } else {
      logger.error(`[InvoiceAutomation] Failed to send payment_reminder:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error(`[InvoiceAutomation] Exception in sendInvoicePaymentReminder:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 2. Send Payment Pending WhatsApp Template (On/after due date if unpaid)
 * Template: payment_follow_up (Utility, en) - Header: "Payment Pending"
 * Variables:
 * {{1}}: Customer Name
 * {{2}}: Amount
 * {{3}}: Service / Item description
 * {{4}}: Invoice Number
 * {{5}}: Due Date (DD/MM/YYYY)
 */
async function sendInvoicePaymentPending(invoice, options = { manual: false }) {
  try {
    if (!options.manual && invoice.pendingSent) {
      return { success: false, reason: 'Pending notification already sent' };
    }

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return { success: false, reason: `Invoice is already marked as ${invoice.status}` };
    }

    const phone = formatPhoneNumber(invoice.customerPhone);
    if (!phone) {
      return { success: false, reason: 'Customer phone number missing or invalid' };
    }

    const waAccount = await getWhatsAppAccountForInvoice(invoice);
    if (!waAccount) {
      return { success: false, reason: 'No active WhatsApp account configured' };
    }

    const token = decryptField(waAccount.accessToken);
    const serviceName = (invoice.items && invoice.items[0]?.description) || 'Services';
    const dueDateStr = formatDate(invoice.dueDate);
    const amountStr = String(invoice.grandTotal || 0);

    const variables = [
      invoice.customerName || 'Customer',
      amountStr,
      serviceName,
      invoice.invoiceNumber,
      dueDateStr
    ];

    const templateComponents = [
      {
        type: 'body',
        parameters: variables.map(val => ({ type: 'text', text: String(val) }))
      }
    ];

    logger.info(`[InvoiceAutomation] Sending payment_follow_up for invoice ${invoice.invoiceNumber} to ${phone}`);

    const result = await whatsapp.sendTemplateMessage(
      waAccount.phoneNumberId,
      token,
      phone,
      'payment_follow_up',
      'en',
      templateComponents
    );

    const fallbackText = `Payment Pending: Hello ${invoice.customerName || 'Customer'}, your payment of Rs. ${amountStr} for ${serviceName} (Invoice No. ${invoice.invoiceNumber}) has been pending since ${dueDateStr}.`;

    await recordOutboundMessage({
      waAccount,
      invoice,
      templateName: 'payment_follow_up',
      variables,
      metaResult: result,
      fallbackText
    });

    if (result.success) {
      const updates = {
        pendingSent: true,
        pendingSentAt: new Date()
      };
      if (invoice.status === 'sent') {
        updates.status = 'payment_due';
      }

      await Invoice.findByIdAndUpdate(invoice._id, updates);

      // Sync Contact lead status in CRM if applicable
      if (invoice.customerId) {
        const contact = await Contact.findById(invoice.customerId);
        if (contact) {
          if (!contact.customFields) contact.customFields = new Map();
          contact.customFields.set('status', 'payment_due');
          contact.markModified('customFields');
          await contact.save();
        }
      }

      await createNotification({
        userId: invoice.userId,
        organizationId: invoice.organizationId,
        type: 'message',
        title: `Payment Pending Alert Sent ⚠️`,
        message: `WhatsApp payment pending alert sent to ${invoice.customerName} for overdue Invoice #${invoice.invoiceNumber} (₹${amountStr}).`,
        link: '/dashboard/invoice-settings?tab=history'
      });

      return { success: true, messageId: result.data?.messages?.[0]?.id };
    } else {
      logger.error(`[InvoiceAutomation] Failed to send payment_follow_up:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error(`[InvoiceAutomation] Exception in sendInvoicePaymentPending:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 3. Send Payment Received WhatsApp Template (When invoice is marked as paid)
 * Template: payment_received (Utility, en) - Header: "Payment Received"
 * Variables:
 * {{1}}: Invoice / Order ID
 * {{2}}: Product / Service
 * {{3}}: Amount Paid
 * {{4}}: Transaction ID
 * {{5}}: Payment Date (DD/MM/YYYY)
 */
async function sendInvoicePaymentReceived(invoice, transactionId = '', options = { manual: false }) {
  try {
    if (!options.manual && invoice.receivedSent) {
      return { success: false, reason: 'Payment received receipt already sent' };
    }

    const phone = formatPhoneNumber(invoice.customerPhone);
    if (!phone) {
      return { success: false, reason: 'Customer phone number missing or invalid' };
    }

    const waAccount = await getWhatsAppAccountForInvoice(invoice);
    if (!waAccount) {
      return { success: false, reason: 'No active WhatsApp account configured' };
    }

    const token = decryptField(waAccount.accessToken);
    const serviceName = (invoice.items && invoice.items[0]?.description) || 'Services';
    const paymentDateStr = formatDate(new Date());
    const amountStr = String(invoice.grandTotal || 0);
    const txnId = transactionId || invoice.selectedOtherAccountId || `TXN-${invoice.invoiceNumber}`;

    const variables = [
      invoice.invoiceNumber,
      serviceName,
      amountStr,
      txnId,
      paymentDateStr
    ];

    const templateComponents = [
      {
        type: 'body',
        parameters: variables.map(val => ({ type: 'text', text: String(val) }))
      }
    ];

    logger.info(`[InvoiceAutomation] Sending payment_received for invoice ${invoice.invoiceNumber} to ${phone}`);

    const result = await whatsapp.sendTemplateMessage(
      waAccount.phoneNumberId,
      token,
      phone,
      'payment_received',
      'en',
      templateComponents
    );

    const fallbackText = `Payment Received: Thank you for your payment! We have successfully received Rs. ${amountStr} for ${serviceName} (Invoice No. ${invoice.invoiceNumber}). Txn ID: ${txnId}.`;

    await recordOutboundMessage({
      waAccount,
      invoice,
      templateName: 'payment_received',
      variables,
      metaResult: result,
      fallbackText
    });

    if (result.success) {
      await Invoice.findByIdAndUpdate(invoice._id, {
        receivedSent: true,
        receivedSentAt: new Date(),
        status: 'paid'
      });

      await createNotification({
        userId: invoice.userId,
        organizationId: invoice.organizationId,
        type: 'message',
        title: `Payment Received Confirmation Sent 💰`,
        message: `WhatsApp payment receipt sent to ${invoice.customerName} for Invoice #${invoice.invoiceNumber} (₹${amountStr}).`,
        link: '/dashboard/invoice-settings?tab=history'
      });

      return { success: true, messageId: result.data?.messages?.[0]?.id };
    } else {
      logger.error(`[InvoiceAutomation] Failed to send payment_received:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error(`[InvoiceAutomation] Exception in sendInvoicePaymentReceived:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Scheduled Automation Check:
 * - Scans all unpaid invoices (status NOT 'paid' or 'cancelled')
 * - Checks dueDate:
 *    - 2 days before dueDate -> sends payment_reminder
 *    - on / after dueDate -> sends payment_follow_up (Payment Pending)
 */
async function checkAndRunInvoiceAutomations() {
  logger.info('[InvoiceAutomation] Running scheduled invoice automation checks...');
  const now = new Date();
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    const invoices = await Invoice.find({
      status: { $nin: ['paid', 'cancelled'] },
      dueDate: { $exists: true, $ne: null }
    });

    logger.info(`[InvoiceAutomation] Found ${invoices.length} active invoices with due dates.`);

    let reminderCount = 0;
    let pendingCount = 0;

    for (const inv of invoices) {
      const due = new Date(inv.dueDate);
      if (isNaN(due.getTime())) continue;

      const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      // Difference in full calendar days (dueDate - today)
      const diffTime = dueDateOnly.getTime() - todayDateOnly.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // 1. Payment Reminder: exactly 2 days before or within 2-day reminder window before due date
      if (diffDays <= 2 && diffDays >= 0 && !inv.reminderSent) {
        logger.info(`[InvoiceAutomation] Triggering 2-day reminder for Invoice ${inv.invoiceNumber} (diffDays: ${diffDays})`);
        const res = await sendInvoicePaymentReminder(inv);
        if (res.success) reminderCount++;
      }

      // 2. Payment Pending: on or past due date (diffDays <= 0)
      if (diffDays <= 0 && !inv.pendingSent) {
        logger.info(`[InvoiceAutomation] Triggering payment pending alert for overdue Invoice ${inv.invoiceNumber} (diffDays: ${diffDays})`);
        const res = await sendInvoicePaymentPending(inv);
        if (res.success) pendingCount++;
      }
    }

    logger.info(`[InvoiceAutomation] Automation run completed. Reminders sent: ${reminderCount}, Pending alerts sent: ${pendingCount}`);
    return { success: true, reminderCount, pendingCount, totalInvoices: invoices.length };
  } catch (err) {
    logger.error('[InvoiceAutomation] Error during automation check:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  formatDate,
  formatPhoneNumber,
  sendInvoicePaymentReminder,
  sendInvoicePaymentPending,
  sendInvoicePaymentReceived,
  checkAndRunInvoiceAutomations,
};
