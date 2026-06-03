const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const Notification = require('../models/Notification');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');

/**
 * Send an in-app notification to all admins/owners of an organization.
 */
async function notifyOrgAdmins(orgId, title, message, type = 'subscription') {
  const admins = await User.find({
    organizationId: orgId,
    role: { $in: ['admin', 'owner'] },
    isDeleted: { $ne: true }
  }).select('_id').lean();

  const notifications = admins.map((admin) => ({
    user: admin._id,
    organization: orgId,
    type,
    title,
    message,
    link: '/dashboard/subscription',
    icon: 'credit-card'
  }));

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }
}

/**
 * Send email reminders to org admins.
 */
async function emailOrgAdmins(orgId, subject, htmlBody) {
  try {
    const emailService = require('./emailService');
    const admins = await User.find({
      organizationId: orgId,
      role: { $in: ['admin', 'owner'] },
      isDeleted: { $ne: true }
    }).select('email name').lean();

    for (const admin of admins) {
      await emailService.sendGenericEmail(admin.email, subject, htmlBody).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to send subscription email:', err.message);
  }
}

/**
 * Daily subscription check cron job.
 * Runs every day at midnight (00:00).
 */
function startSubscriptionCron() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[SubscriptionCron] Running daily subscription check...');
    try {
      await processExpiryReminders();
      await processExpiredSubscriptions();
      console.log('[SubscriptionCron] Daily check completed.');
    } catch (err) {
      console.error('[SubscriptionCron] Error:', err.message);
    }
  });

  console.log('[SubscriptionCron] Scheduled daily subscription check at midnight.');
}

/**
 * Send reminders for subscriptions expiring in 7, 3, and 1 days.
 */
async function processExpiryReminders() {
  const now = new Date();
  const reminderDays = [7, 3, 1];

  for (const days of reminderDays) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const expiringSubs = await Subscription.find({
      status: { $in: ['active', 'expiring_soon'] },
      expiryDate: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    for (const sub of expiringSubs) {
      // Update status to expiring_soon
      await Subscription.updateOne({ _id: sub._id }, { status: 'expiring_soon' });
      await Organization.updateOne({ _id: sub.organizationId }, { subscriptionStatus: 'expiring_soon' });

      const org = await Organization.findById(sub.organizationId).lean();
      const orgName = org ? org.name : 'Your organization';

      // In-app notification
      await notifyOrgAdmins(
        sub.organizationId,
        `Subscription Expiring in ${days} Day${days > 1 ? 's' : ''}`,
        `Your subscription for ${orgName} will expire in ${days} day${days > 1 ? 's' : ''}. Please renew to continue using the platform.`
      );

      // Email notification
      const expiryFormatted = new Date(sub.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      await emailOrgAdmins(
        sub.organizationId,
        `⚠️ Subscription Expiring in ${days} Day${days > 1 ? 's' : ''} — ${orgName}`,
        `<div style="font-family:sans-serif;padding:20px;">
          <h2 style="color:#f59e0b;">⚠️ Subscription Expiry Reminder</h2>
          <p>Your subscription for <strong>${orgName}</strong> will expire on <strong>${expiryFormatted}</strong>.</p>
          <p>Please renew your plan to continue using WhatsApp messaging, campaigns, bots, and all platform features.</p>
          <p style="margin-top:20px;"><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/subscription" style="background:#25d366;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Renew Now</a></p>
        </div>`
      );
    }

    if (expiringSubs.length > 0) {
      console.log(`[SubscriptionCron] Sent ${expiringSubs.length} reminder(s) for ${days}-day expiry.`);
    }
  }
}

/**
 * Expire overdue subscriptions & disable org access.
 */
async function processExpiredSubscriptions() {
  const now = new Date();
  const config = await SubscriptionPlan.getConfig();
  const graceDays = config.gracePeriodDays || 0;

  // Calculate cutoff: expiry + grace period
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - graceDays);

  const expiredSubs = await Subscription.find({
    status: { $in: ['active', 'expiring_soon'] },
    expiryDate: { $lt: cutoff }
  }).lean();

  for (const sub of expiredSubs) {
    // Mark subscription as expired
    await Subscription.updateOne({ _id: sub._id }, { status: 'expired' });

    // Disable the organization
    await Organization.updateOne(
      { _id: sub.organizationId },
      {
        subscriptionStatus: 'expired',
        status: 'inactive',
        // Disconnect Meta WhatsApp integration
        'metaConfig.whatsapp.status': 'disconnected',
        'metaConfig.whatsapp.statusDetails.errorReason': 'Subscription expired — auto-disconnected',
        'metaConfig.whatsapp.statusDetails.lastVerified': now
      }
    );

    const org = await Organization.findById(sub.organizationId).lean();
    const orgName = org ? org.name : 'Your organization';

    // Notify admins
    await notifyOrgAdmins(
      sub.organizationId,
      'Subscription Expired',
      `Your subscription for ${orgName} has expired. All messaging services have been disabled. Please renew immediately.`
    );

    // Email notification
    const expiryFormatted = new Date(sub.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await emailOrgAdmins(
      sub.organizationId,
      `🚫 Subscription Expired — ${orgName}`,
      `<div style="font-family:sans-serif;padding:20px;">
        <h2 style="color:#ef4444;">🚫 Subscription Expired</h2>
        <p>Your subscription for <strong>${orgName}</strong> expired on <strong>${expiryFormatted}</strong>.</p>
        <p>All WhatsApp messaging, campaigns, bots, and platform features have been <strong>disabled</strong>.</p>
        <p>Your Meta WhatsApp integration has been <strong>automatically disconnected</strong>.</p>
        <p style="margin-top:20px;"><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/subscription" style="background:#ef4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Renew Now</a></p>
      </div>`
    );

    // Notify super admin
    const superAdmins = await User.find({ role: 'superadmin', isDeleted: { $ne: true } }).select('_id').lean();
    for (const sa of superAdmins) {
      await Notification.create({
        user: sa._id,
        organization: sub.organizationId,
        type: 'subscription',
        title: 'Organization Subscription Expired',
        message: `${orgName}'s subscription has expired and their account has been disabled.`,
        link: '/dashboard/admin',
        icon: 'alert-triangle'
      });
    }
  }

  if (expiredSubs.length > 0) {
    console.log(`[SubscriptionCron] Expired ${expiredSubs.length} subscription(s) and disabled orgs.`);
  }
}

module.exports = { startSubscriptionCron, processExpiryReminders, processExpiredSubscriptions };
