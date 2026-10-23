const crypto = require('crypto');
const Organization = require('../models/Organization');
const WalletTransaction = require('../models/WalletTransaction');
const WalletRateCard = require('../models/WalletRateCard');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// Helper: Generate unique transaction ID
function generateTxnId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TXN-${dateStr}-${randomStr}`;
}

// Helper: Generate unique invoice number
function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const randomStr = Math.floor(1000 + Math.random() * 9000);
  return `WAL-INV-${year}-${randomStr}`;
}

/**
 * Get current wallet balance and config for an organization
 */
async function getWalletBalance(organizationId) {
  const org = await Organization.findById(organizationId).select('walletBalance walletCurrency lowBalanceAlert name');
  if (!org) return { balance: 0, currency: 'INR', lowBalanceThreshold: 100 };
  return {
    balance: Number((org.walletBalance || 0).toFixed(2)),
    currency: org.walletCurrency || 'INR',
    lowBalanceThreshold: org.lowBalanceAlert?.threshold ?? 100,
    orgName: org.name
  };
}

/**
 * Get rate card for organization or default rates
 */
async function getRates(organizationId = null) {
  let rateCard = null;
  if (organizationId) {
    rateCard = await WalletRateCard.findOne({ organizationId });
  }
  if (!rateCard) {
    rateCard = await WalletRateCard.findOne({ isDefault: true });
  }
  if (rateCard) {
    return {
      marketing: rateCard.marketing,
      utility: rateCard.utility,
      authentication: rateCard.authentication,
      service: rateCard.service,
      currency: rateCard.currency || 'INR'
    };
  }
  // Standard Meta India Rates
  return {
    marketing: 0.85,
    utility: 0.15,
    authentication: 0.15,
    service: 0.35,
    currency: 'INR'
  };
}

/**
 * Check if organization has sufficient balance
 */
async function checkBalance(organizationId, requiredAmount = 1) {
  const { balance } = await getWalletBalance(organizationId);
  return {
    hasBalance: balance >= requiredAmount,
    currentBalance: balance,
    requiredAmount: Number(requiredAmount.toFixed(2)),
    shortfall: balance < requiredAmount ? Number((requiredAmount - balance).toFixed(2)) : 0
  };
}

/**
 * Credit amount to organization wallet
 */
async function creditWallet({
  organizationId,
  userId = null,
  amount,
  category = 'topup_razorpay',
  paymentDetails = {},
  description = 'Wallet Top-up',
  io = null
}) {
  const parsedAmount = Number(Number(amount).toFixed(2));
  if (parsedAmount <= 0) {
    throw new Error('Credit amount must be greater than zero');
  }

  const org = await Organization.findById(organizationId);
  if (!org) throw new Error('Organization not found');

  const openingBalance = Number((org.walletBalance || 0).toFixed(2));
  const closingBalance = Number((openingBalance + parsedAmount).toFixed(2));

  // Atomic update to organization balance
  const updatedOrg = await Organization.findByIdAndUpdate(
    organizationId,
    { $inc: { walletBalance: parsedAmount } },
    { new: true }
  );

  const finalBalance = Number((updatedOrg.walletBalance || 0).toFixed(2));
  const txnId = generateTxnId();
  const invoiceNum = paymentDetails.invoiceNumber || generateInvoiceNumber();

  const transaction = await WalletTransaction.create({
    organizationId,
    userId,
    transactionId: txnId,
    type: 'credit',
    amount: parsedAmount,
    openingBalance,
    closingBalance: finalBalance,
    category,
    status: 'success',
    description,
    paymentDetails: {
      ...paymentDetails,
      invoiceNumber: invoiceNum
    }
  });

  logger.info(`[WALLET CREDIT] Org: ${organizationId}, Amount: +₹${parsedAmount}, New Balance: ₹${finalBalance}, Txn: ${txnId}`);

  // Emit real-time socket event to organization room
  if (io) {
    io.to(`organization_${organizationId}`).emit('wallet_balance_updated', {
      balance: finalBalance,
      delta: parsedAmount,
      type: 'credit',
      transaction
    });
  }

  return {
    success: true,
    newBalance: finalBalance,
    transaction
  };
}

/**
 * Debit amount from organization wallet (Concurrency Safe)
 */
async function debitWallet({
  organizationId,
  userId = null,
  amount,
  category = 'meta_marketing',
  metaData = {},
  description = '',
  io = null
}) {
  const parsedAmount = Number(Number(amount).toFixed(2));
  if (parsedAmount <= 0) {
    throw new Error('Debit amount must be greater than zero');
  }

  // Idempotency check for Meta webhook events: avoid duplicate debit for same message
  if (metaData?.metaMessageId) {
    const existing = await WalletTransaction.findOne({
      organizationId,
      'metaData.metaMessageId': metaData.metaMessageId,
      status: 'success'
    });
    if (existing) {
      logger.info(`[WALLET DEBIT SKIPPED] Already debited for message ${metaData.metaMessageId}`);
      return { success: true, alreadyProcessed: true, transaction: existing };
    }
  }

  const org = await Organization.findById(organizationId);
  if (!org) throw new Error('Organization not found');

  const currentBalance = Number((org.walletBalance || 0).toFixed(2));
  if (currentBalance < parsedAmount) {
    const err = new Error('Insufficient wallet balance');
    err.code = 'INSUFFICIENT_WALLET_BALANCE';
    err.currentBalance = currentBalance;
    err.requiredAmount = parsedAmount;
    throw err;
  }

  // Atomic conditional deduction
  const updatedOrg = await Organization.findOneAndUpdate(
    { _id: organizationId, walletBalance: { $gte: parsedAmount } },
    { $inc: { walletBalance: -parsedAmount } },
    { new: true }
  );

  if (!updatedOrg) {
    const err = new Error('Insufficient wallet balance (concurrent transaction)');
    err.code = 'INSUFFICIENT_WALLET_BALANCE';
    throw err;
  }

  const finalBalance = Number((updatedOrg.walletBalance || 0).toFixed(2));
  const txnId = generateTxnId();

  const transaction = await WalletTransaction.create({
    organizationId,
    userId,
    transactionId: txnId,
    type: 'debit',
    amount: parsedAmount,
    openingBalance: currentBalance,
    closingBalance: finalBalance,
    category,
    status: 'success',
    description: description || `WhatsApp Charge: ${category.replace('meta_', '').toUpperCase()}`,
    metaData
  });

  logger.info(`[WALLET DEBIT] Org: ${organizationId}, Amount: -₹${parsedAmount}, New Balance: ₹${finalBalance}, Txn: ${txnId}`);

  // Emit real-time socket event
  if (io) {
    io.to(`organization_${organizationId}`).emit('wallet_balance_updated', {
      balance: finalBalance,
      delta: -parsedAmount,
      type: 'debit',
      transaction
    });

    // Check low balance threshold
    const threshold = updatedOrg.lowBalanceAlert?.threshold ?? 100;
    if (finalBalance <= threshold) {
      io.to(`organization_${organizationId}`).emit('wallet_low_balance_alert', {
        balance: finalBalance,
        threshold,
        message: `Your wallet balance is low (₹${finalBalance.toFixed(2)}). Please recharge to keep messages sending.`
      });
    }
  }

  return {
    success: true,
    newBalance: finalBalance,
    transaction
  };
}

/**
 * Submit manual UPI QR top-up request (Pending admin approval)
 */
async function submitUpiTopup({
  organizationId,
  userId,
  amount,
  utrNumber,
  screenshot = '',
  notes = '',
  io = null
}) {
  const parsedAmount = Number(Number(amount).toFixed(2));
  if (parsedAmount <= 0) throw new Error('Invalid top-up amount');
  if (!utrNumber || utrNumber.trim().length < 6) throw new Error('Please enter a valid 12-digit UPI Reference / UTR Number');

  // Check for duplicate UTR
  const existingUtr = await WalletTransaction.findOne({
    'paymentDetails.utrNumber': utrNumber.trim(),
    status: { $in: ['pending', 'success'] }
  });
  if (existingUtr) {
    throw new Error('This UTR / Transaction Reference has already been submitted.');
  }

  const org = await Organization.findById(organizationId);
  const currentBalance = Number((org?.walletBalance || 0).toFixed(2));
  const txnId = generateTxnId();

  const transaction = await WalletTransaction.create({
    organizationId,
    userId,
    transactionId: txnId,
    type: 'credit',
    amount: parsedAmount,
    openingBalance: currentBalance,
    closingBalance: currentBalance, // will change on approval
    category: 'topup_upi_qr',
    status: 'pending',
    description: `UPI QR Top-up Request (UTR: ${utrNumber.trim()})`,
    paymentDetails: {
      utrNumber: utrNumber.trim(),
      screenshot,
      notes,
      invoiceNumber: generateInvoiceNumber()
    }
  });

  logger.info(`[WALLET UPI SUBMISSION] Org: ${organizationId}, Amount: ₹${parsedAmount}, UTR: ${utrNumber}, Txn: ${txnId}`);

  if (io) {
    // Notify superadmins/admins of new pending request
    io.emit('wallet_pending_approval', {
      transactionId: txnId,
      amount: parsedAmount,
      organizationId,
      utrNumber
    });
  }

  return transaction;
}

/**
 * Admin: Approve pending UPI top-up request
 */
async function approveUpiTopup({ transactionId, adminUserId, io = null }) {
  const txn = await WalletTransaction.findOne({ transactionId, status: 'pending' });
  if (!txn) throw new Error('Pending transaction not found or already processed');

  const org = await Organization.findById(txn.organizationId);
  if (!org) throw new Error('Organization not found');

  const openingBalance = Number((org.walletBalance || 0).toFixed(2));
  const closingBalance = Number((openingBalance + txn.amount).toFixed(2));

  // Atomic update
  const updatedOrg = await Organization.findByIdAndUpdate(
    txn.organizationId,
    { $inc: { walletBalance: txn.amount } },
    { new: true }
  );

  const finalBalance = Number((updatedOrg.walletBalance || 0).toFixed(2));

  txn.status = 'success';
  txn.openingBalance = openingBalance;
  txn.closingBalance = finalBalance;
  txn.paymentDetails.verifiedBy = adminUserId;
  txn.paymentDetails.verifiedAt = new Date();
  await txn.save();

  logger.info(`[WALLET UPI APPROVED] Txn: ${transactionId}, Approved By: ${adminUserId}, Added: ₹${txn.amount}, New Balance: ₹${finalBalance}`);

  if (io) {
    io.to(`organization_${txn.organizationId}`).emit('wallet_balance_updated', {
      balance: finalBalance,
      delta: txn.amount,
      type: 'credit',
      transaction: txn
    });
  }

  return { success: true, transaction: txn, newBalance: finalBalance };
}

/**
 * Admin: Reject pending UPI top-up request
 */
async function rejectUpiTopup({ transactionId, adminUserId, reason = 'Invalid payment reference' }) {
  const txn = await WalletTransaction.findOne({ transactionId, status: 'pending' });
  if (!txn) throw new Error('Pending transaction not found');

  txn.status = 'rejected';
  txn.paymentDetails.verifiedBy = adminUserId;
  txn.paymentDetails.verifiedAt = new Date();
  txn.paymentDetails.rejectionReason = reason;
  await txn.save();

  logger.info(`[WALLET UPI REJECTED] Txn: ${transactionId}, Reason: ${reason}`);
  return { success: true, transaction: txn };
}

/**
 * Superadmin: Manual Balance Adjustment (Credit or Debit)
 */
async function manualAdjustment({
  organizationId,
  adminUserId,
  type = 'credit',
  amount,
  reason = 'Admin adjustment',
  io = null
}) {
  const parsedAmount = Number(Number(amount).toFixed(2));
  if (parsedAmount <= 0) throw new Error('Adjustment amount must be positive');

  if (type === 'credit') {
    return creditWallet({
      organizationId,
      userId: adminUserId,
      amount: parsedAmount,
      category: 'topup_manual',
      description: `Manual Credit: ${reason}`,
      paymentDetails: { notes: reason, verifiedBy: adminUserId, verifiedAt: new Date() },
      io
    });
  } else {
    return debitWallet({
      organizationId,
      userId: adminUserId,
      amount: parsedAmount,
      category: 'adjustment',
      description: `Manual Debit: ${reason}`,
      io
    });
  }
}

module.exports = {
  getWalletBalance,
  getRates,
  checkBalance,
  creditWallet,
  debitWallet,
  submitUpiTopup,
  approveUpiTopup,
  rejectUpiTopup,
  manualAdjustment
};
