const Queue = require('bull');
const env = require('../config/env');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const whatsapp = require('./whatsapp');
const { decryptField } = require('./encryption');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const campaignQueues = new Map();
let scheduleQueue = null;
let ioInstance = null;

function getCampaignQueue(userId) {
  const queueName = `campaign-messages-${userId}`;
  if (campaignQueues.has(queueName)) {
    return campaignQueues.get(queueName);
  }

  const queue = new Queue(queueName, env.REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
    limiter: {
      max: parseInt(process.env.TENANT_CAMPAIGN_LIMIT_MAX, 10) || 10,
      duration: 1000,
    },
  });

  // Process campaign messages
  queue.process(async (job) => {
    const { campaignId, contactId, userId: jobUserId, templateName, variables, phoneNumberId, accessToken, headerMediaId } = job.data;

    try {
      const contact = await Contact.findOne({ _id: contactId, userId: jobUserId, optedOut: { $ne: true }, isDeleted: { $ne: true } });
      if (!contact) {
        await Campaign.updateOne({ _id: campaignId }, { $inc: { 'stats.failed': 1 } });
        return { skipped: true, reason: 'Contact not found or opted out' };
      }

      const token = decryptField(accessToken);
      const templateComponents = [];

      if (headerMediaId) {
        templateComponents.push({
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: {
                id: headerMediaId
              }
            }
          ]
        });
      }

      if (variables.length > 0) {
        templateComponents.push({
          type: 'body',
          parameters: variables.map((v) => ({ type: 'text', text: v }))
        });
      }

      const result = await whatsapp.sendTemplateMessage(phoneNumberId, token, contact.phone, templateName, 'en', templateComponents);

      if (result.success) {
        await Campaign.updateOne({ _id: campaignId }, { $inc: { 'stats.sent': 1 } });

        // Resolve template text for visual chat bubbles
        let templateText = '';
        try {
          const Template = require('../models/Template');
          const tmpl = await Template.findOne({ userId: jobUserId, name: templateName });
          if (tmpl) {
            const bodyComp = tmpl.components?.find(c => c.type === 'BODY' || c.type?.toLowerCase() === 'body');
            if (bodyComp && bodyComp.text) {
              templateText = bodyComp.text;
              if (variables && variables.length > 0) {
                templateText = templateText.replace(/\{\{([0-9]+)\}\}/g, (_, num) => {
                  const idx = parseInt(num, 10) - 1;
                  return variables[idx] !== undefined ? variables[idx] : `{{${num}}}`;
                });
              }
            }
          }
        } catch (err) {
          logger.error(`Error looking up template for log text: ${err.message}`);
        }

        // Save outbound message
        let conversation = await Conversation.findOne({ userId: jobUserId, contactId: contact._id });
        const isNewConversation = !conversation;
        if (!conversation) {
          conversation = await Conversation.create({ userId: jobUserId, contactId: contact._id, status: 'bot', source: 'campaign', campaignId });
        }

        const message = await Message.create({
          userId: jobUserId,
          conversationId: conversation._id,
          contactId: contact._id,
          direction: 'outbound',
          type: 'template',
          content: {
            text: templateText || `[Template: ${templateName}]`,
            template: { name: templateName, variables }
          },
          status: 'sent',
          metaMessageId: result.data?.messages?.[0]?.id,
          sentBy: 'system',
          campaignId,
        });

        conversation.lastMessageAt = new Date();
        await conversation.save();

        // Emit new message socket event to frontend
        if (ioInstance) {
          const { getOekForUser, decryptMessage } = require('./oekService');
          const rawOek = await getOekForUser(jobUserId);
          const decryptedMsg = decryptMessage(message, rawOek);
          ioInstance.to(`user_${jobUserId}`).emit('new_message', {
            message: decryptedMsg,
            contact: contact.toObject(),
            conversationId: conversation._id,
            isNewConversation,
          });
        }
      } else {
        await Campaign.updateOne({ _id: campaignId }, { $inc: { 'stats.failed': 1 } });

        const isRateLimit = result.status === 429 || result.code === 429 || result.code === 130429 || result.error_subcode === 130429;
        if (isRateLimit) {
          try {
            const User = require('../models/User');
            const user = await User.findById(jobUserId).lean();
            if (user && user.organizationId) {
              const { createNotification } = require('./notificationService');
              await createNotification({
                userId: jobUserId,
                organizationId: user.organizationId,
                type: 'campaign',
                title: 'Rate Limit Reached ⚠️',
                message: `Meta API rate limit reached during campaign. Error: ${result.error || 'Too Many Requests'}.`,
                link: '/dashboard/campaigns',
                metadata: { campaignId, errorCode: result.code }
              });
            }
          } catch (err) {
            logger.error('Failed to trigger rate limit notification:', err.message);
          }
        }
      }

      // Emit progress
      if (ioInstance) {
        const campaign = await Campaign.findById(campaignId).lean();
        if (campaign) {
          ioInstance.to(`user_${jobUserId}`).emit('campaign_progress', {
            campaignId,
            stats: campaign.stats,
            totalCount: campaign.audience?.totalCount || 0,
          });
        }
      }

      return { success: result.success };
    } catch (error) {
      logger.error(`Campaign job error: ${error.message}`, { campaignId, contactId });
      await Campaign.updateOne({ _id: campaignId }, { $inc: { 'stats.failed': 1 } });
      throw error;
    }
  });

  // On campaign queue completion
  queue.on('completed', async (job) => {
    try {
      const { campaignId } = job.data;
      const waiting = await queue.getWaitingCount();
      const active = await queue.getActiveCount();
      if (waiting === 0 && active === 0) {
        const campaignObj = await Campaign.findOne({ _id: campaignId, status: 'running' });
        if (campaignObj) {
          campaignObj.status = 'completed';
          campaignObj.completedAt = new Date();
          await campaignObj.save();

          logger.info(`Campaign ${campaignId} completed`);

          const totalFailed = campaignObj.stats?.failed || 0;
          const totalSent = campaignObj.stats?.sent || 0;
          const isFailedCampaign = totalFailed > 0 && totalSent === 0;

          const User = require('../models/User');
          const user = await User.findById(campaignObj.userId).lean();
          if (user && user.organizationId) {
            const { createNotification } = require('./notificationService');
            if (isFailedCampaign) {
              await createNotification({
                userId: campaignObj.userId,
                organizationId: user.organizationId,
                type: 'campaign',
                title: 'Campaign Failed ❌',
                message: `Your campaign "${campaignObj.name}" failed completely. All messages failed to send.`,
                link: '/dashboard/campaigns',
                metadata: { campaignId }
              });
            } else {
              await createNotification({
                userId: campaignObj.userId,
                organizationId: user.organizationId,
                type: 'campaign',
                title: 'Campaign Completed 🎉',
                message: `Your campaign "${campaignObj.name}" has completed sending messages.`,
                link: '/dashboard/campaigns',
                metadata: { campaignId }
              });
            }
          }
        }
      }
    } catch (err) {
      logger.error('Campaign completion check error:', err.message);
    }
  });

  queue.on('failed', (job, err) => {
    logger.error(`Campaign job failed: ${err.message}`, { jobId: job.id });
  });

  campaignQueues.set(queueName, queue);
  return queue;
}

async function initQueues(io) {
  ioInstance = io;

  scheduleQueue = new Queue('scheduled-campaigns', env.REDIS_URL);

  if (process.env.RUN_QUEUE_PROCESSORS !== 'false') {
    logger.info('Registering background queue processors in this instance');

    // Startup check: Find and initialize queues for any currently running campaigns
    try {
      const activeCampaigns = await Campaign.find({ status: 'running' }).select('userId').lean();
      const activeUserIds = [...new Set(activeCampaigns.map(c => c.userId.toString()))];
      for (const uId of activeUserIds) {
        getCampaignQueue(uId);
      }
      if (activeUserIds.length > 0) {
        logger.info(`Initialized campaign queues for active user IDs on startup: ${activeUserIds.join(', ')}`);
      }
    } catch (err) {
      logger.error('Error initializing active campaign queues on startup:', err.message);
    }

    // Schedule queue — check for due campaigns and sequences every minute
    scheduleQueue.process(async () => {
      // 1. Process due campaigns
      const due = await Campaign.find({
        status: 'scheduled',
        scheduledAt: { $lte: new Date() },
      });
      for (const campaign of due) {
        logger.info(`Starting scheduled campaign: ${campaign._id}`);
        await startCampaign(campaign._id, campaign.userId);
      }

      // 2. Process due sequences
      await processDueSequences();

      // 3. Process automatic health monitoring for Meta integrations
      await checkMetaIntegrationsHealth();
    });

    // Add recurring check
    scheduleQueue.add({}, { repeat: { every: 60000 } });
  } else {
    logger.info('Background queue processors are disabled (API-only mode)');
  }

  logger.info('Bull queues initialized');
}

/**
 * Start a campaign — add all contacts as jobs.
 */
async function startCampaign(campaignId, userId) {
  const campaign = await Campaign.findOne({ _id: campaignId, userId });
  if (!campaign) throw new Error('Campaign not found');

  const waAccount = await WhatsAppAccount.findOne({ userId, isActive: true });
  if (!waAccount) throw new Error('No active WhatsApp account');

  // Build contact query
  let contactQuery = { userId, optedOut: { $ne: true }, isDeleted: { $ne: true } };
  if (campaign.audience.type === 'tag' && campaign.audience.tags?.length) {
    contactQuery.tags = { $in: campaign.audience.tags };
  } else if (campaign.audience.type === 'upload' && campaign.audience.contactIds?.length) {
    contactQuery._id = { $in: campaign.audience.contactIds };
  } else if (campaign.audience.type === 'group' && campaign.audience.groupIds?.length) {
    const ContactGroup = require('../models/ContactGroup');
    const mapping = await ContactGroup.find({ groupId: { $in: campaign.audience.groupIds } }).select('contactId').lean();
    const contactIds = mapping.map(m => m.contactId);
    contactQuery._id = { $in: contactIds };
  }

  const contacts = await Contact.find(contactQuery).select('_id').lean();

  campaign.audience.totalCount = contacts.length;
  campaign.status = 'running';
  campaign.startedAt = new Date();
  campaign.stats = { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, optedOut: 0 };
  await campaign.save();

  // Add each contact as a job
  const jobs = contacts.map((c) => ({
    data: {
      campaignId: campaign._id.toString(),
      contactId: c._id.toString(),
      userId: userId.toString(),
      templateName: campaign.templateName,
      variables: campaign.variables || [],
      phoneNumberId: waAccount.phoneNumberId,
      accessToken: waAccount.accessToken,
      headerMediaId: campaign.headerMediaId,
    },
  }));

  if (jobs.length > 0) {
    const queue = getCampaignQueue(userId);
    await queue.addBulk(jobs);
  }

  logger.info(`Campaign ${campaignId} started with ${contacts.length} contacts`);

  // Create persistent notification for campaign start
  try {
    const User = require('../models/User');
    const user = await User.findById(userId).lean();
    if (user && user.organizationId) {
      const { createNotification } = require('./notificationService');
      await createNotification({
        userId,
        organizationId: user.organizationId,
        type: 'campaign',
        title: 'Campaign Started 🚀',
        message: `Your campaign "${campaign.name}" has started sending messages to ${contacts.length} contact(s).`,
        link: '/dashboard/campaigns',
        metadata: { campaignId: campaign._id }
      });
    }
  } catch (err) {
    logger.error('Failed to trigger campaign start notification:', err.message);
  }

  return { totalContacts: contacts.length };
}

async function pauseCampaign(campaignId) {
  const campaign = await Campaign.findById(campaignId).select('userId').lean();
  if (campaign) {
    const queue = getCampaignQueue(campaign.userId.toString());
    await queue.pause();
  }
  await Campaign.updateOne({ _id: campaignId }, { status: 'paused' });
}

async function resumeCampaign(campaignId) {
  const campaign = await Campaign.findById(campaignId).select('userId').lean();
  if (campaign) {
    const queue = getCampaignQueue(campaign.userId.toString());
    await queue.resume();
  }
  await Campaign.updateOne({ _id: campaignId }, { status: 'running' });
}

async function getQueueStatus() {
  let cActive = 0, cWaiting = 0, cCompleted = 0, cFailed = 0, cDelayed = 0, cPaused = false;
  
  for (const [name, queue] of campaignQueues.entries()) {
    try {
      const [act, wait, comp, fail, del, paused] = await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);
      cActive += act;
      cWaiting += wait;
      cCompleted += comp;
      cFailed += fail;
      cDelayed += del;
      if (paused) cPaused = true;
    } catch (err) {
      logger.error(`Error getting status for queue ${name}:`, err.message);
    }
  }

  if (!scheduleQueue) {
    return {
      campaign: { active: cActive, waiting: cWaiting, completed: cCompleted, failed: cFailed, delayed: cDelayed, paused: cPaused, status: 'ready' },
      schedule: { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0, paused: false, status: 'uninitialized' }
    };
  }

  const [sActive, sWaiting, sCompleted, sFailed, sDelayed, sPaused] = await Promise.all([
    scheduleQueue.getActiveCount(),
    scheduleQueue.getWaitingCount(),
    scheduleQueue.getCompletedCount(),
    scheduleQueue.getFailedCount(),
    scheduleQueue.getDelayedCount(),
    scheduleQueue.isPaused(),
  ]);

  return {
    campaign: { active: cActive, waiting: cWaiting, completed: cCompleted, failed: cFailed, delayed: cDelayed, paused: cPaused, status: 'ready' },
    schedule: { active: sActive, waiting: sWaiting, completed: sCompleted, failed: sFailed, delayed: sDelayed, paused: sPaused, status: 'ready' }
  };
}

async function cleanQueue(queueName, type) {
  if (queueName === 'campaign-messages') {
    for (const queue of campaignQueues.values()) {
      await queue.clean(0, type);
    }
  } else {
    if (!scheduleQueue) throw new Error('Queue not initialized');
    await scheduleQueue.clean(0, type);
  }
}

async function pauseQueue(queueName) {
  if (queueName === 'campaign-messages') {
    for (const queue of campaignQueues.values()) {
      await queue.pause();
    }
  } else {
    if (!scheduleQueue) throw new Error('Queue not initialized');
    await scheduleQueue.pause();
  }
}

async function resumeQueue(queueName) {
  if (queueName === 'campaign-messages') {
    for (const queue of campaignQueues.values()) {
      await queue.resume();
    }
  } else {
    if (!scheduleQueue) throw new Error('Queue not initialized');
    await scheduleQueue.resume();
  }
}

async function getRedisStatus() {
  const checkQueue = scheduleQueue || (campaignQueues.size > 0 ? campaignQueues.values().next().value : null);
  if (!checkQueue || !checkQueue.client) {
    return { status: 'disconnected', error: 'Redis client not initialized' };
  }
  try {
    const pingResult = await checkQueue.client.ping();
    return {
      status: checkQueue.client.status,
      ping: pingResult,
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function processDueSequences() {
  try {
    const now = new Date();
    // Find all running sequence executions that are due
    const executions = await require('../models/SequenceExecution').find({
      status: 'running',
      scheduledAt: { $lte: now }
    });

    for (const exec of executions) {
      try {
        const Sequence = require('../models/Sequence');
        const seq = await Sequence.findById(exec.sequenceId);
        if (!seq || !seq.isActive) {
          exec.status = 'cancelled';
          await exec.save();
          continue;
        }

        const stepIndex = exec.nextStepIndex;
        const msgStep = seq.messages[stepIndex];
        if (!msgStep) {
          exec.status = 'completed';
          await exec.save();
          continue;
        }

        // Send template message to contact
        const Contact = require('../models/Contact');
        const contact = await Contact.findOne({ _id: exec.contactId, userId: exec.userId, isDeleted: { $ne: true } });
        if (!contact) {
          exec.status = 'cancelled';
          await exec.save();
          continue;
        }

        const WhatsAppAccount = require('../models/WhatsAppAccount');
        const waAccount = await WhatsAppAccount.findOne({ userId: exec.userId, isActive: true });
        if (!waAccount) {
          logger.warn(`No active WhatsApp account for sequence execution userId: ${exec.userId}`);
          continue;
        }

        const token = decryptField(waAccount.accessToken);
        const result = await whatsapp.sendTemplateMessage(
          waAccount.phoneNumberId,
          token,
          contact.phone,
          msgStep.templateName,
          'en',
          []
        );

        // Find or create conversation
        const Conversation = require('../models/Conversation');
        let conversation = await Conversation.findOne({ userId: exec.userId, contactId: contact._id });
        if (!conversation) {
          conversation = await Conversation.create({
            userId: exec.userId,
            contactId: contact._id,
            status: 'bot',
            source: 'sequence'
          });
        }

        let msgStatus = 'failed';
        let msgId = null;

        if (result.success) {
          msgStatus = 'sent';

          // Resolve template text for visual chat bubbles
          let templateText = '';
          try {
            const Template = require('../models/Template');
            const tmpl = await Template.findOne({ userId: exec.userId, name: msgStep.templateName });
            if (tmpl) {
              const bodyComp = tmpl.components?.find(c => c.type === 'BODY' || c.type?.toLowerCase() === 'body');
              if (bodyComp && bodyComp.text) {
                templateText = bodyComp.text;
              }
            }
          } catch (err) {
            logger.error(`Error looking up template for sequence text: ${err.message}`);
          }

          // Save outbound message
          const message = await Message.create({
            userId: exec.userId,
            conversationId: conversation._id,
            contactId: contact._id,
            direction: 'outbound',
            type: 'template',
            content: {
              text: templateText || `[Template: ${msgStep.templateName}]`,
              template: { name: msgStep.templateName, variables: [] }
            },
            status: 'sent',
            metaMessageId: result.data?.messages?.[0]?.id,
            sentBy: 'system',
          });

          conversation.lastMessageAt = new Date();
          await conversation.save();

          msgId = message._id;

          // Emit new message socket event to frontend
          if (ioInstance) {
            const { getOekForUser, decryptMessage } = require('./oekService');
            const rawOek = await getOekForUser(exec.userId);
            const decryptedMsg = decryptMessage(message, rawOek);
            ioInstance.to(`user_${exec.userId}`).emit('new_message', {
              message: decryptedMsg,
              contact: contact.toObject(),
              conversationId: conversation._id,
            });
          }
        }

        // Add log
        exec.logs.push({
          stepIndex,
          templateName: msgStep.templateName,
          messageId: msgId,
          status: result.success ? 'sent' : 'failed',
          error: result.error,
          sentAt: new Date()
        });

        // Determine next step
        const nextStepIndex = stepIndex + 1;
        if (nextStepIndex < seq.messages.length) {
          const nextMsg = seq.messages[nextStepIndex];
          let delayMs = 0;
          if (nextMsg.delayUnit === 'minutes') delayMs = nextMsg.delayValue * 60 * 1000;
          else if (nextMsg.delayUnit === 'hours') delayMs = nextMsg.delayValue * 60 * 60 * 1000;
          else delayMs = nextMsg.delayValue * 24 * 60 * 60 * 1000;

          exec.nextStepIndex = nextStepIndex;
          exec.scheduledAt = new Date(Date.now() + delayMs);
        } else {
          exec.status = 'completed';
        }

        await exec.save();

      } catch (err) {
        logger.error(`Error processing sequence execution step: ${err.message}`, { execId: exec._id });
      }
    }
  } catch (error) {
    logger.error(`Error in processDueSequences: ${error.message}`);
  }
}

async function checkMetaIntegrationsHealth() {
  try {
    const Organization = require('../models/Organization');
    const { decryptField } = require('./encryption');
    const axios = require('axios');
    
    // Find all organizations that have WhatsApp config and need health checks (every 15 mins)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const orgs = await Organization.find({
      'metaConfig.whatsapp.accessToken': { $ne: '' },
      $or: [
        { 'metaConfig.whatsapp.statusDetails.lastVerified': { $lt: fifteenMinutesAgo } },
        { 'metaConfig.whatsapp.statusDetails.lastVerified': { $exists: false } },
        { 'metaConfig.whatsapp.statusDetails.lastVerified': null }
      ]
    });

    if (orgs.length === 0) return;

    logger.info(`Running automatic Meta health diagnostics for ${orgs.length} organizations`);

    for (const org of orgs) {
      const token = decryptField(org.metaConfig.whatsapp.accessToken);
      if (!token) continue;

      const now = new Date();
      // Support mock sandbox tokens
      if (token === 'demo' || token === 'mock' || token.startsWith('mock_')) {
        org.metaConfig.whatsapp.status = 'connected';
        org.metaConfig.whatsapp.statusDetails.lastVerified = now;
        org.metaConfig.whatsapp.statusDetails.tokenStatus = 'Active';
        org.metaConfig.whatsapp.statusDetails.errorReason = '';
        await org.save();
        continue;
      }

      // Real API validation
      try {
        const GRAPH_URL = 'https://graph.facebook.com/v18.0';
        await axios.get(`${GRAPH_URL}/${org.metaConfig.whatsapp.phoneNumberId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        org.metaConfig.whatsapp.status = 'connected';
        org.metaConfig.whatsapp.statusDetails.lastVerified = now;
        org.metaConfig.whatsapp.statusDetails.tokenStatus = 'Active';
        org.metaConfig.whatsapp.statusDetails.errorReason = '';
        await org.save();
      } catch (err) {
        logger.error(`Health diagnostic failed for organization ${org.name}:`, err.message);
        
        // Handle developer Sandbox/Dev mode where API access is blocked but webhook works!
        const isApiBlocked = err.response?.data?.error?.message?.includes('API access blocked') || err.message?.includes('API access blocked');
        if (isApiBlocked) {
          org.metaConfig.whatsapp.status = 'connected';
          org.metaConfig.whatsapp.statusDetails.lastVerified = now;
          org.metaConfig.whatsapp.statusDetails.tokenStatus = 'Active (Sandbox/Dev)';
          org.metaConfig.whatsapp.statusDetails.errorReason = '';
          await org.save();
          continue;
        }

        org.metaConfig.whatsapp.status = 'error';
        org.metaConfig.whatsapp.statusDetails.lastVerified = now;
        org.metaConfig.whatsapp.statusDetails.tokenStatus = 'Expired/Invalid';
        org.metaConfig.whatsapp.statusDetails.errorReason = 'WhatsApp connection lost. Please reconnect.';
        await org.save();

        // Emit real-time warnings to organization members
        if (ioInstance) {
          const User = require('../models/User');
          const users = await User.find({ organizationId: org._id });
          for (const u of users) {
            ioInstance.to(`user_${u._id.toString()}`).emit('meta_integration_warning', {
              type: 'whatsapp',
              message: 'WhatsApp connection lost. Please reconnect.'
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error('Error running Meta integration health checks:', err.message);
  }
}

module.exports = {
  initQueues,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  getQueueStatus,
  cleanQueue,
  pauseQueue,
  resumeQueue,
  getRedisStatus
};
