const cron = require('node-cron');
const FollowUp = require('../models/FollowUp');
const Contact = require('../models/Contact');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const whatsapp = require('./whatsapp');
const { decryptField } = require('./encryption');
const { createNotification } = require('./notificationService');
const { sendGenericEmail } = require('./emailService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

function startFollowUpCron() {
  // Run minutely: '* * * * *'
  cron.schedule('* * * * *', async () => {
    logger.info('[FollowUpCron] Checking scheduled follow-ups...');
    const now = new Date();
    try {
      // 1. Send 1-hour upcoming reminders
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const upcomingFollowUps = await FollowUp.find({
        status: 'pending',
        scheduledAt: { $gt: now, $lte: oneHourFromNow },
        remindedHourBefore: { $ne: true }
      });

      for (const fu of upcomingFollowUps) {
        fu.remindedHourBefore = true;
        await fu.save();

        await createNotification({
          userId: fu.assignedTo,
          organizationId: fu.organizationId,
          type: 'contact',
          title: 'Upcoming Follow-Up Reminder ⏰',
          message: `The follow-up "${fu.title}" is scheduled in 1 hour.`,
          link: '/dashboard/contacts',
          metadata: { followUpId: fu._id }
        });
      }

      // 2. Send overdue notifications for any pending past-due follow-ups
      const overdueFollowUps = await FollowUp.find({
        status: 'pending',
        scheduledAt: { $lt: now },
        remindedOverdue: { $ne: true }
      });

      for (const fu of overdueFollowUps) {
        fu.remindedOverdue = true;
        await fu.save();

        await createNotification({
          userId: fu.assignedTo,
          organizationId: fu.organizationId,
          type: 'contact',
          title: 'Follow-Up Overdue ⚠️',
          message: `The follow-up "${fu.title}" is now overdue.`,
          link: '/dashboard/contacts',
          metadata: { followUpId: fu._id }
        });
      }

      // 3. Process/execute scheduled follow-ups
      const followUps = await FollowUp.find({
        status: 'pending',
        scheduledAt: { $lte: now },
      });

      if (followUps.length === 0) {
        return;
      }

      logger.info(`[FollowUpCron] Found ${followUps.length} follow-ups to process.`);

      for (const followUp of followUps) {
        // Atomic update to completed status to guarantee single execution (no duplicates)
        const updated = await FollowUp.findOneAndUpdate(
          { _id: followUp._id, status: 'pending' },
          { status: 'completed', completedAt: new Date() },
          { new: true }
        );

        if (!updated) {
          // Already processed by another concurrent process / thread
          continue;
        }

        try {
          await executeFollowUp(updated);
          logger.info(`[FollowUpCron] Successfully executed follow-up ${followUp._id}`);
        } catch (err) {
          logger.error(`[FollowUpCron] Execution failed for follow-up ${followUp._id}: ${err.message}`);
          // Keep the status as 'completed' to prevent endless retry loops, but log details.
        }
      }
    } catch (err) {
      logger.error('[FollowUpCron] Scheduler check error:', err.message);
    }
  });

  logger.info('[FollowUpCron] Scheduler successfully initialized (checks minutely).');
}

async function executeFollowUp(followUp) {
  const contact = await Contact.findById(followUp.contactId);
  if (!contact || contact.isDeleted) {
    throw new Error('Contact not found or is deleted');
  }

  const assignedUser = await User.findById(followUp.assignedTo);
  if (!assignedUser) {
    throw new Error('Assigned user not found');
  }

  const orgId = followUp.organizationId;

  // Resolve OEK key if encrypted
  let contactPhone = contact.phone;
  if (contact.isEncrypted) {
    try {
      const { getOekForUser, decryptContact } = require('./oekService');
      const rawOek = await getOekForUser(followUp.createdBy);
      if (rawOek) {
        const decrypted = decryptContact(contact, rawOek);
        contactPhone = decrypted.phone;
      }
    } catch (_) {}
  }

  switch (followUp.followUpType) {
    case 'whatsapp': {
      // Find active WhatsApp account associated with the organization owner / creator
      const owner = await User.findOne({ organizationId: orgId, role: 'owner' });
      const waAccount = await WhatsAppAccount.findOne({
        userId: owner ? owner._id : followUp.createdBy,
        isActive: true,
      });

      if (!waAccount) {
        throw new Error(`No active WhatsApp account configured for organization: ${orgId}`);
      }

      const token = decryptField(waAccount.accessToken);
      const phoneNumberId = waAccount.phoneNumberId;
      const messageText = followUp.description || followUp.title;

      // Send the text message via Meta API
      const result = await whatsapp.sendTextMessage(phoneNumberId, token, contactPhone, messageText);
      if (!result.success) {
        throw new Error(`Meta API error: ${result.error || 'Unknown error'}`);
      }

      // Save outbound message to chat logs
      let conversation = await Conversation.findOne({ userId: waAccount.userId, contactId: contact._id });
      if (!conversation) {
        conversation = await Conversation.create({
          userId: waAccount.userId,
          contactId: contact._id,
          status: 'bot',
          source: 'manual',
          organization_id: orgId,
        });
      }

      await Message.create({
        userId: waAccount.userId,
        conversationId: conversation._id,
        contactId: contact._id,
        direction: 'outbound',
        type: 'text',
        content: { text: messageText },
        status: 'sent',
        metaMessageId: result.data?.messages?.[0]?.id,
        sentBy: 'system',
      });

      // Send in-app notification to the assignee
      await createNotification({
        userId: followUp.assignedTo,
        organizationId: orgId,
        type: 'message',
        title: `WhatsApp Auto-Sent: ${followUp.title}`,
        message: `Follow-up message sent to ${contact.name || contactPhone}.`,
        link: '/dashboard/inbox',
      });
      break;
    }

    case 'email': {
      if (assignedUser.email) {
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #2563eb; margin: 0 0 15px 0; font-size: 20px;">📧 Follow-up Task Reminder</h2>
            <p style="color: #334155; font-size: 15px; margin: 0 0 10px 0;">Hi ${assignedUser.name},</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">This is an automated reminder for your scheduled follow-up task.</p>
            <div style="padding: 15px; bg-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>Task Title:</strong> ${followUp.title}</p>
              <p style="margin: 5px 0;"><strong>Notes:</strong> ${followUp.description || '-'}</p>
              <p style="margin: 5px 0;"><strong>Customer:</strong> ${contact.name || 'Unnamed'} (${contactPhone})</p>
              <p style="margin: 5px 0;"><strong>Scheduled For:</strong> ${new Date(followUp.scheduledAt).toLocaleString()}</p>
            </div>
            <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 15px;">HK Automation System</p>
          </div>
        `;

        await sendGenericEmail(assignedUser.email, `Follow-up Reminder: ${followUp.title}`, htmlBody);
      }

      // Send in-app notification to the assignee
      await createNotification({
        userId: followUp.assignedTo,
        organizationId: orgId,
        type: 'system',
        title: `Reminder Email Sent: ${followUp.title}`,
        message: `Task details sent to ${assignedUser.email}.`,
        link: '/dashboard/contacts',
      });
      break;
    }

    case 'call': {
      // Send in-app call notification
      await createNotification({
        userId: followUp.assignedTo,
        organizationId: orgId,
        type: 'contact',
        title: `📞 Call Reminder: ${followUp.title}`,
        message: `Call ${contact.name || contactPhone}. Description: ${followUp.description || ''}`,
        link: '/dashboard/call-logs',
      });
      break;
    }

    case 'manual': {
      // Send in-app manual task notification
      await createNotification({
        userId: followUp.assignedTo,
        organizationId: orgId,
        type: 'system',
        title: `📋 Manual Task Due: ${followUp.title}`,
        message: `Details: ${followUp.description || ''} (Contact: ${contact.name || contactPhone})`,
        link: '/dashboard/contacts',
      });
      break;
    }

    default:
      throw new Error(`Unknown follow-up type: ${followUp.followUpType}`);
  }
}

module.exports = { startFollowUpCron };
