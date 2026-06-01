const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const BotFlow = require('../models/BotFlow');
const BotMediaAsset = require('../models/BotMediaAsset');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const whatsapp = require('./whatsapp');
const { decryptField } = require('./encryption');

/**
 * Resolves an assetKey or mediaUrl to a real URL by querying BotMediaAsset if needed.
 */
async function resolveAssetUrl(botId, mediaUrlOrKey) {
  if (!mediaUrlOrKey) return '';
  const trimmed = mediaUrlOrKey.trim();
  // If it's already a full HTTP or relative upload URL, return it
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/')) {
    return trimmed;
  }
  try {
    const asset = await BotMediaAsset.findOne({ botId, assetKey: trimmed });
    if (asset) {
      return asset.fileUrl;
    }
  } catch (err) {
    logger.error('Error resolving assetKey:', err);
  }
  return trimmed; // Fallback
}
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const { getRedisClient } = require('../config/redis');
const redis = getRedisClient();

/**
 * Detect source from message text.
 */
function detectSource(text) {
  if (!text) return 'direct';
  const lower = text.toLowerCase();
  if (lower.includes('instagram') || lower.includes('insta') || lower.includes('ig post')) return 'instagram';
  if (lower.includes('facebook') || lower.includes('fb')) return 'facebook';
  if (lower.includes('website') || lower.includes('web')) return 'website';
  return 'direct';
}

/**
 * Main entry point — process incoming WhatsApp message.
 */
async function processIncomingMessage(messageData, phoneNumberId, io) {
  try {
    // 1. Find which business account this belongs to
    const waAccount = await WhatsAppAccount.findOne({ phoneNumberId, isActive: true });
    if (!waAccount) {
      logger.warn(`No active WA account for phoneNumberId: ${phoneNumberId}`);
      return;
    }
    const userId = waAccount.userId;

    // Deduplicate incoming messages from Meta webhook using message ID stored in Redis (multi-instance safe)
    if (messageData.id) {
      try {
        const redisKey = `webhook:msg:${userId}:${messageData.id}`;
        const isNew = await redis.set(redisKey, '1', 'NX', 'EX', 120);
        if (!isNew) {
          logger.info(`Duplicate message received via webhook (Redis), skipping: ${messageData.id}`);
          return;
        }
      } catch (err) {
        logger.error(`Redis deduplication error: ${err.message}. Falling back to database check.`);
        const existingMsg = await Message.findOne({ userId, metaMessageId: messageData.id });
        if (existingMsg) {
          logger.info(`Duplicate message found in database, skipping: ${messageData.id}`);
          return;
        }
      }
    }

    const token = decryptField(waAccount.accessToken);
    const from = messageData.from;
    const msgType = messageData.type || 'text';

    // Log incoming webhook event
    try {
      await require('../models/ApiLog').create({
        userId,
        type: 'webhook_incoming',
        method: 'POST',
        url: '/webhook',
        requestBody: messageData,
        responseBody: { status: 'processed' },
        statusCode: 200,
        ip: 'meta-webhook'
      });
    } catch (_) {}

    const referral = messageData.referral;

    // 2. Find or create Contact
    const { getOekForUser, generateHMAC } = require('./oekService');
    const rawOek = await getOekForUser(userId);
    let contact;
    if (rawOek) {
      const phoneHash = generateHMAC(from, rawOek);
      contact = await Contact.findOne({ userId, $or: [{ phone: from }, { phoneHash }] });
    } else {
      contact = await Contact.findOne({ userId, phone: from });
    }
    const isNewContact = !contact;
    if (!contact) {
      let source = msgType === 'text' ? detectSource(messageData.text?.body) : 'direct';
      if (referral) {
        if (referral.source_url?.includes('instagram.com') || referral.source_url?.includes('instagr.am')) {
          source = 'instagram';
        } else if (referral.source_url?.includes('facebook.com') || referral.source_url?.includes('fb.me')) {
          source = 'facebook';
        } else {
          source = referral.source_type || 'direct';
        }
      }
      contact = await Contact.create({
        userId,
        phone: from,
        name: messageData.profile?.name || '',
        source,
        tags: source !== 'direct' ? [source] : [],
      });
    } else if (referral) {
      let newSource = '';
      if (referral.source_url?.includes('instagram.com') || referral.source_url?.includes('instagr.am')) {
        newSource = 'instagram';
      } else if (referral.source_url?.includes('facebook.com') || referral.source_url?.includes('fb.me')) {
        newSource = 'facebook';
      } else {
        newSource = referral.source_type;
      }

      if (newSource && contact.source === 'direct') {
        contact.source = newSource;
        if (!contact.tags.includes(newSource)) {
          contact.tags.push(newSource);
        }
        await contact.save();
      }
    }

    // 3. Find or create Conversation
    const User = require('../models/User');
    const Organization = require('../models/Organization');
    const adminUser = await User.findById(userId);
    const org = adminUser ? await Organization.findById(adminUser.organizationId) : null;

    let conversation = await Conversation.findOne({ userId, contactId: contact._id });
    const isNewConversation = !conversation;
    if (!conversation) {
      if (org) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const count = await Conversation.countDocuments({ userId, createdAt: { $gte: startOfMonth } });
        if (count >= org.maxMonthlyConversations) {
          logger.warn(`Max monthly conversations limit of ${org.maxMonthlyConversations} reached for organization ${org.name}. Blocking incoming conversation.`);
          return;
        }
      }

      conversation = await Conversation.create({
        userId,
        contactId: contact._id,
        status: 'bot',
        source: contact.source,
        lastMessageAt: new Date(),
        organization_id: adminUser ? adminUser.organizationId : null,
      });
    } else if (!conversation.organization_id && adminUser) {
      conversation.organization_id = adminUser.organizationId;
      await conversation.save();
    }

    // 4. Extract content from message
    const content = extractContent(messageData, msgType);

    // Dynamic Media Downloader for Inbound Media assets
    if (content.mediaId) {
      try {
        const fs = require('fs');
        const path = require('path');
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const extMap = {
          'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
          'video/mp4': '.mp4', 'audio/mp4': '.m4a', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg',
          'application/pdf': '.pdf', 'text/plain': '.txt'
        };
        const mimeType = messageData[msgType]?.mime_type || 'application/octet-stream';
        const ext = extMap[mimeType] || '.bin';
        const filename = `incoming-${messageData.id || Date.now()}${ext}`;
        const destPath = path.join(uploadDir, filename);

        const dlResult = await whatsapp.downloadMedia(content.mediaId, token, destPath);
        if (dlResult.success) {
          content.mediaUrl = `/uploads/${filename}`;
        }
      } catch (err) {
        logger.error('Failed to execute inbound media download:', err.message);
      }
    }

    // 5. Save inbound message
    const savedMsg = await Message.create({
      userId,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'inbound',
      type: msgType,
      content,
      status: 'delivered',
      metaMessageId: messageData.id,
      sentBy: 'system',
      timestamp: new Date(parseInt(messageData.timestamp) * 1000 || Date.now()),
    });

    // Update contact & conversation
    contact.lastMessageAt = new Date();
    contact.totalMessages = (contact.totalMessages || 0) + 1;
    await contact.save();

    conversation.lastMessageAt = new Date();
    conversation.isRead = false;
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    await conversation.save();

    // Trigger real-time message notification
    const { createNotification } = require('./notificationService');
    createNotification({
      userId,
      organizationId: conversation.organization_id || (adminUser ? adminUser.organizationId : null),
      type: 'message',
      title: `New Message from ${contact.name || contact.phone}`,
      message: content.text || `Sent a ${msgType} attachment.`,
      link: '/dashboard/inbox'
    }).catch(err => logger.error('Failed to trigger message notification:', err.message));



    // Mark as read on WhatsApp
    if (messageData.id) {
      whatsapp.markAsRead(phoneNumberId, token, messageData.id).catch(() => {});
    }

    // 6. Emit to Socket.io for live inbox
    if (io) {
      io.to(`user_${userId}`).emit('new_message', {
        message: savedMsg.toObject(),
        contact: contact.toObject(),
        conversationId: conversation._id,
        isNewConversation,
      });
    }


    // Run keyword triggers, auto-tags, auto-routing
    const handledByAutomations = await runAutomations(userId, conversation, contact, savedMsg, phoneNumberId, token, io);
    if (handledByAutomations) return;

    // 7. Route based on conversation status
    if (conversation.status === 'human' || conversation.lock_status || conversation.takeover_status === 'human') {
      // Just save message, notify agent
      const agentId = conversation.assigned_agent_id || conversation.assignedAgent;
      if (io && agentId) {
        io.to(`user_${agentId}`).emit('new_message', {
          message: savedMsg.toObject(),
          contact: contact.toObject(),
          conversationId: conversation._id,
        });
      }
      return;
    }

    if (conversation.status === 'ai') {
      // AI is deprecated, route to human agent
      conversation.status = 'human';
      await conversation.save();
      await sendAndSaveMessage(
        userId, conversation, contact, phoneNumberId, token,
        "Connecting you to our team right now! ⚡ Someone will be with you shortly.",
        'bot', io
      );
      if (io) io.to(`user_${userId}`).emit('conversation_assigned', { conversationId: conversation._id, needsAgent: true });
      
      // Trigger handoff notification
      const { createNotification } = require('./notificationService');
      createNotification({
        userId,
        organizationId: conversation.organization_id || (adminUser ? adminUser.organizationId : null),
        type: 'bot',
        title: `Handoff Requested: ${contact.name || contact.phone}`,
        message: `Customer is waiting for an agent takeover.`,
        link: '/dashboard/inbox'
      }).catch(err => logger.error('Failed to trigger handoff notification:', err.message));

      return;
    }

    if (conversation.status === 'waiting' || conversation.status === 'resolved') {
      // Reset flow variables and set status back to bot
      conversation.status = 'bot';
      conversation.currentNodeId = null;
      conversation.currentFlowId = null;
      conversation.flowVariables = new Map();
      conversation.flowVariables.set('features', 'None'); // Reset features list to default
      conversation.markModified('flowVariables');
      await conversation.save();

      // Notify customer that we are restarting the flow from the beginning
      await sendAndSaveMessage(
        userId,
        conversation,
        contact,
        phoneNumberId,
        token,
        "Let's start our conversation from the beginning! 🚀",
        'bot',
        io
      );
    }

    // 8. Process bot flow
    await processBotFlow(userId, conversation, contact, content, msgType, phoneNumberId, token, io, isNewConversation);
  } catch (error) {
    logger.error('processIncomingMessage error:', error);
  }
}

/**
 * Extract content from Meta message payload.
 */
function extractContent(messageData, msgType) {
  const content = {};
  if (messageData.referral) {
    content.referral = messageData.referral;
  }
  switch (msgType) {
    case 'text':
      content.text = messageData.text?.body || '';
      break;
    case 'image':
      content.mediaId = messageData.image?.id;
      content.caption = messageData.image?.caption || '';
      break;
    case 'video':
      content.mediaId = messageData.video?.id;
      content.caption = messageData.video?.caption || '';
      break;
    case 'audio':
      content.mediaId = messageData.audio?.id;
      break;
    case 'document':
      content.mediaId = messageData.document?.id;
      content.filename = messageData.document?.filename || '';
      break;
    case 'interactive':
      if (messageData.interactive?.type === 'button_reply') {
        content.text = messageData.interactive.button_reply.id;
        content.interactive = messageData.interactive.button_reply;
      } else if (messageData.interactive?.type === 'list_reply') {
        content.text = messageData.interactive.list_reply.id;
        content.interactive = messageData.interactive.list_reply;
      }
      break;
    case 'reaction':
      content.reaction = messageData.reaction?.emoji;
      break;
    case 'location':
      content.location = {
        latitude: messageData.location?.latitude,
        longitude: messageData.location?.longitude,
        name: messageData.location?.name,
        address: messageData.location?.address,
      };
      break;
    case 'sticker':
      content.mediaId = messageData.sticker?.id;
      break;
    default:
      content.text = JSON.stringify(messageData);
  }
  return content;
}



/**
 * Process the bot flow for a message.
 */
async function processBotFlow(userId, conversation, contact, content, msgType, phoneNumberId, token, io, isNew) {
  try {
    let flow = null;
    let currentNode = null;

    if (conversation.currentFlowId && conversation.currentNodeId) {
      // Continue existing flow
      flow = await BotFlow.findOne({ _id: conversation.currentFlowId, userId });
      if (flow) {
        currentNode = flow.nodes.find((n) => n.id === conversation.currentNodeId);
      }
    }

    if (!flow || !currentNode) {
      // Find matching flow
      const activeFlows = await BotFlow.find({ userId, isActive: true }).lean();
      const userText = (content.text || '').toLowerCase().trim();

      for (const f of activeFlows) {
        if (f.trigger.type === 'any') {
          flow = f;
          break;
        }
        if (f.trigger.type === 'keyword' && f.trigger.keywords?.length) {
          if (f.trigger.keywords.some((kw) => userText.includes(kw.toLowerCase()))) {
            flow = f;
            break;
          }
        }
        if (f.trigger.type === 'source' && f.trigger.source === contact.source) {
          flow = f;
          break;
        }
      }

      if (!flow && activeFlows.length > 0) {
        flow = activeFlows[0];
      }

      if (flow) {
        currentNode = flow.nodes.find((n) => n.id === (flow.entryNodeId || flow.nodes[0]?.id));
        conversation.currentFlowId = flow._id;
        conversation.flowVariables = new Map();
        conversation.markModified('flowVariables');
        flow.totalSessions = (flow.totalSessions || 0) + 1;
        await BotFlow.updateOne({ _id: flow._id }, { $inc: { totalSessions: 1 } });
        isNew = true; // Mark as new session so we don't consume the triggering text as first question answer
      }
    }

    if (!flow || !currentNode) {
      // No matching flow — send default
      return;
    }

    // If current node is a question and we got a reply, save the variable, then advance
    if (currentNode.type === 'question' && !isNew && content.text) {
      const varName = currentNode.data?.variable;
      if (varName) {
        if (varName === 'features') {
          const selectionId = content.text;
          const selectionTitle = content.interactive?.title || selectionId;

          if (selectionId === 'feat_done') {
            // User is done selecting. If features is still "None" or empty, set to a default
            let current = conversation.flowVariables.get('features') || '';
            if (current === 'None' || current === '') {
              conversation.flowVariables.set('features', 'None selected');
            }
          } else {
            // User selected a feature. Append it and loop.
            let current = conversation.flowVariables.get('features') || '';
            if (current === 'None' || current === 'None yet' || current === '') {
              current = selectionTitle;
            } else {
              const list = current.split(', ').map(s => s.trim());
              if (!list.includes(selectionTitle)) {
                current = `${current}, ${selectionTitle}`;
              }
            }
            conversation.flowVariables.set('features', current);
            conversation.markModified('flowVariables');
            conversation.currentNodeId = currentNode.id;
            await conversation.save();

            // Run executeNode on same node to send the updated list back to the user
            await executeNode(userId, conversation, contact, flow, currentNode, phoneNumberId, token, io, content);
            return;
          }
        } else {
          conversation.flowVariables.set(varName, content.text || content.interactive?.title || '');
        }
      }
      // Move to next node
      let nextEdge = currentNode.edges?.[0];
      if (currentNode.edges && currentNode.edges.length > 1) {
        const textVal = (content.text || '').toLowerCase().trim();
        const titleVal = (content.interactive?.title || '').toLowerCase().trim();
        const idVal = (content.interactive?.id || '').toLowerCase().trim();

        // Helper to check exact match on any edge
        const findExactMatch = (val) => {
          if (!val) return null;
          return currentNode.edges.find((e) => {
            const edgeLabel = (e.label || '').toLowerCase().trim();
            const condVal = (e.condition?.value || '').toLowerCase().trim();
            const labels = edgeLabel.split(',').map(s => s.trim());
            return labels.some(l => l === val) || condVal === val;
          });
        };

        // Helper to check partial match on any edge
        const findPartialMatch = (val) => {
          if (!val) return null;
          return currentNode.edges.find((e) => {
            const edgeLabel = (e.label || '').toLowerCase().trim();
            const condVal = (e.condition?.value || '').toLowerCase().trim();
            const labels = edgeLabel.split(',').map(s => s.trim());
            return labels.some(l => 
              l === val || 
              (l && val.includes(l)) || 
              (val && l.includes(val))
            ) || condVal === val;
          });
        };

        // Pass 1: Try to find an exact match first (highest priority) across all inputs
        let matchedEdge = findExactMatch(idVal) || findExactMatch(textVal) || findExactMatch(titleVal);

        // Pass 2: Fall back to partial match logic if no exact match exists
        if (!matchedEdge) {
          matchedEdge = findPartialMatch(idVal) || findPartialMatch(textVal) || findPartialMatch(titleVal);
        }

        if (matchedEdge) {
          nextEdge = matchedEdge;
        }
      }

      if (nextEdge) {
        currentNode = flow.nodes.find((n) => n.id === nextEdge.targetNodeId);
      } else {
        // Flow completed
        await completeFlow(conversation);
        return;
      }
    }

    // If current node is AI and we got a reply, check for completion or 5-minute timeout, and query the AI again
    if (currentNode.type === 'ai' && !isNew && content.text) {
      const startTimeStr = conversation.flowVariables.get('ai_start_time');
      const elapsedMs = startTimeStr ? (Date.now() - new Date(startTimeStr).getTime()) : 0;
      const isTimeout = elapsedMs > 5 * 60 * 1000; // 5 minutes

      let isFinished = false;
      let replyText = '';

      if (isTimeout) {
        logger.info('AI node timeout reached (> 5 minutes). Transitioning to next node.');
        isFinished = true;
      } else {
        const prompt = currentNode.data?.aiPrompt || '';
        const history = await Message.find({ userId, conversationId: conversation._id })
          .sort({ timestamp: -1 }).limit(10).lean();
        history.reverse();

        // Fetch user and organization to retrieve custom AI keys
        const User = require('../models/User');
        const Organization = require('../models/Organization');
        const user = await User.findById(userId);
        const org = user ? await Organization.findById(user.organizationId).lean() : null;

        const aiResp = await aiAgent.processWithAI(history, contact, content.text || '', prompt, org);
        
        replyText = aiResp.text || '';
        if (replyText.toUpperCase().startsWith('FINISHED')) {
          isFinished = true;
          replyText = replyText.replace(/^FINISHED[:\s,.-]*/i, '').trim();
        } else if (replyText.toUpperCase().includes('FINISHED')) {
          isFinished = true;
          replyText = replyText.replace(/FINISHED/gi, '').trim();
        }
      }

      if (replyText) {
        await sendAndSaveMessage(userId, conversation, contact, phoneNumberId, token, replyText, 'ai', io);
      }

      if (isFinished) {
        // Transition to next node
        const nextEdge = currentNode.edges?.[0];
        if (nextEdge) {
          currentNode = flow.nodes.find((n) => n.id === nextEdge.targetNodeId);
          conversation.currentNodeId = currentNode?.id;
          await conversation.save();
        } else {
          await completeFlow(conversation);
          return;
        }
      } else {
        // Not finished yet -> keep pause state and wait for next user message
        conversation.currentNodeId = currentNode.id;
        await conversation.save();
        return;
      }
    }

    // Execute nodes in sequence until we hit a question or end
    await executeNode(userId, conversation, contact, flow, currentNode, phoneNumberId, token, io, content);
  } catch (error) {
    logger.error('Bot flow error:', error);
  }
}

/**
 * Execute a bot flow node recursively.
 */
async function executeNode(userId, conversation, contact, flow, node, phoneNumberId, token, io, content) {
  if (!node) {
    await completeFlow(conversation);
    return;
  }

  const vars = Object.fromEntries(conversation.flowVariables || new Map());
  if (!vars['features']) {
    vars['features'] = 'None';
  }

  switch (node.type) {
    case 'message': {
      const msgData = node.data?.message;
      if (msgData?.type === 'buttons') {
        const text = interpolate(msgData.text || '', vars);
        const buttons = (msgData.buttons || []).map((b) => ({ id: b.id, title: b.title }));
        const result = await whatsapp.sendButtonMessage(phoneNumberId, token, contact.phone, text, buttons);
        await saveAndEmitMessage(userId, conversation, contact, text, 'bot', io, 'interactive', msgData, result);
      } else if (msgData?.type === 'list') {
        const body = interpolate(msgData.body || '', vars);
        const header = interpolate(msgData.header || '', vars);
        const footer = interpolate(msgData.footer || '', vars);
        const result = await whatsapp.sendListMessage(phoneNumberId, token, contact.phone, body, msgData.sections || [], header, footer);
        await saveAndEmitMessage(userId, conversation, contact, body, 'bot', io, 'interactive', { interactive: msgData }, result);
      } else if (msgData?.type === 'image') {
        let imageUrl = msgData.mediaUrl || '';
        if (msgData.assetKey) {
          imageUrl = await resolveAssetUrl(flow._id, msgData.assetKey);
        } else {
          imageUrl = await resolveAssetUrl(flow._id, imageUrl);
        }
        imageUrl = interpolate(imageUrl, vars);
        const caption = interpolate(msgData.caption || '', vars);
        const result = await whatsapp.sendImageMessage(phoneNumberId, token, contact.phone, imageUrl, caption);
        await saveAndEmitMessage(userId, conversation, contact, caption, 'bot', io, 'image', { mediaUrl: result.sentUrl || imageUrl }, result);
      } else {
        const text = interpolate(msgData?.text || node.data?.message?.text || '', vars);
        if (text) {
          const result = await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, text);
          await saveAndEmitMessage(userId, conversation, contact, text, 'bot', io, 'text', {}, result);
        }
      }
      // Advance to next
      const nextEdge = node.edges?.[0];
      if (nextEdge) {
        const next = flow.nodes.find((n) => n.id === nextEdge.targetNodeId);
        conversation.currentNodeId = next?.id;
        await conversation.save();
        await executeNode(userId, conversation, contact, flow, next, phoneNumberId, token, io, content);
      } else {
        await completeFlow(conversation);
      }
      break;
    }

    case 'question': {
      const msgData = node.data?.message;
      if (msgData?.type === 'buttons') {
        const text = interpolate(msgData.text || '', vars);
        const buttons = (msgData.buttons || []).map((b) => ({ id: b.id, title: b.title }));
        const result = await whatsapp.sendButtonMessage(phoneNumberId, token, contact.phone, text, buttons);
        await saveAndEmitMessage(userId, conversation, contact, text, 'bot', io, 'interactive', msgData, result);
      } else if (msgData?.type === 'list') {
        const body = interpolate(msgData.body || '', vars);
        const header = interpolate(msgData.header || '', vars);
        const footer = interpolate(msgData.footer || '', vars);
        const result = await whatsapp.sendListMessage(phoneNumberId, token, contact.phone, body, msgData.sections || [], header, footer);
        await saveAndEmitMessage(userId, conversation, contact, body, 'bot', io, 'interactive', { interactive: msgData }, result);
      } else if (msgData?.type === 'image') {
        let imageUrl = msgData.mediaUrl || '';
        if (msgData.assetKey) {
          imageUrl = await resolveAssetUrl(flow._id, msgData.assetKey);
        } else {
          imageUrl = await resolveAssetUrl(flow._id, imageUrl);
        }
        imageUrl = interpolate(imageUrl, vars);
        const caption = interpolate(msgData.caption || '', vars);
        const result = await whatsapp.sendImageMessage(phoneNumberId, token, contact.phone, imageUrl, caption);
        await saveAndEmitMessage(userId, conversation, contact, caption, 'bot', io, 'image', { mediaUrl: result.sentUrl || imageUrl }, result);
      } else {
        const text = interpolate(msgData?.text || node.data?.message?.text || '', vars);
        if (text) {
          const result = await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, text);
          await saveAndEmitMessage(userId, conversation, contact, text, 'bot', io, 'text', {}, result);
        }
      }
      // Wait for reply — save current node
      conversation.currentNodeId = node.id;
      await conversation.save();
      break;
    }

    case 'condition': {
      const cond = node.data?.condition;
      const varValue = vars[cond?.variable] || '';
      let matched = false;
      const op = cond?.operator || 'equals';
      const target = (cond?.value || '').toLowerCase();
      const val = varValue.toLowerCase();

      if (op === 'equals') matched = val === target;
      else if (op === 'contains') matched = val.includes(target);
      else if (op === 'not_equals') matched = val !== target;
      else if (op === 'exists') matched = !!varValue;

      const edge = matched
        ? node.edges?.find((e) => e.label === 'true' || e.condition?.branch === 'true') || node.edges?.[0]
        : node.edges?.find((e) => e.label === 'false' || e.condition?.branch === 'false') || node.edges?.[1];

      if (edge) {
        const next = flow.nodes.find((n) => n.id === edge.targetNodeId);
        conversation.currentNodeId = next?.id;
        await conversation.save();
        await executeNode(userId, conversation, contact, flow, next, phoneNumberId, token, io, content);
      } else {
        await completeFlow(conversation);
      }
      break;
    }

    case 'delay': {
      const delaySec = node.data?.delaySeconds || 5;
      const nextEdge = node.edges?.[0];
      if (nextEdge) {
        conversation.currentNodeId = node.id;
        await conversation.save();
        setTimeout(async () => {
          const next = flow.nodes.find((n) => n.id === nextEdge.targetNodeId);
          conversation.currentNodeId = next?.id;
          await conversation.save();
          await executeNode(userId, conversation, contact, flow, next, phoneNumberId, token, io, content);
        }, delaySec * 1000);
      }
      break;
    }

    case 'action': {
      const action = node.data?.action;
      if (action?.type === 'tag' && action.tag) {
        if (!contact.tags.includes(action.tag)) {
          contact.tags.push(action.tag);
          await contact.save();
        }
      } else if (action?.type === 'assign' && action.agentId) {
        conversation.assignedAgent = action.agentId;
        conversation.status = 'human';
        await conversation.save();
        if (io) io.to(`user_${action.agentId}`).emit('conversation_assigned', { conversationId: conversation._id });
      } else if (action?.type === 'notify') {
        if (io) io.to(`user_${userId}`).emit('bot_notification', { contact: contact.toObject(), message: action.message });
      }
      const nextEdge = node.edges?.[0];
      if (nextEdge) {
        const next = flow.nodes.find((n) => n.id === nextEdge.targetNodeId);
        conversation.currentNodeId = next?.id;
        await conversation.save();
        await executeNode(userId, conversation, contact, flow, next, phoneNumberId, token, io, content);
      } else {
        await completeFlow(conversation);
      }
      break;
    }

    case 'ai': {
      const prompt = node.data?.aiPrompt || '';
      
      // Initialize AI start time if not already present
      if (!conversation.flowVariables.get('ai_start_time')) {
        conversation.flowVariables.set('ai_start_time', new Date().toISOString());
        conversation.markModified('flowVariables');
        await conversation.save();
      }

      const history = await Message.find({ userId, conversationId: conversation._id })
        .sort({ timestamp: -1 }).limit(10).lean();
      history.reverse();

      // Fetch user and organization to retrieve custom AI keys
      const User = require('../models/User');
      const Organization = require('../models/Organization');
      const user = await User.findById(userId);
      const org = user ? await Organization.findById(user.organizationId).lean() : null;

      const aiResp = await aiAgent.processWithAI(history, contact, content.text || '', prompt, org);
      
      let isFinished = false;
      let replyText = aiResp.text || '';
      
      if (replyText.toUpperCase().startsWith('FINISHED')) {
        isFinished = true;
        replyText = replyText.replace(/^FINISHED[:\s,.-]*/i, '').trim();
      } else if (replyText.toUpperCase().includes('FINISHED')) {
        isFinished = true;
        replyText = replyText.replace(/FINISHED/gi, '').trim();
      }

      if (replyText) {
        await sendAndSaveMessage(userId, conversation, contact, phoneNumberId, token, replyText, 'ai', io);
      }

      if (isFinished) {
        // Transition to next node
        const nextEdge = node.edges?.[0];
        if (nextEdge) {
          const next = flow.nodes.find((n) => n.id === nextEdge.targetNodeId);
          conversation.currentNodeId = next?.id;
          await conversation.save();
          await executeNode(userId, conversation, contact, flow, next, phoneNumberId, token, io, content);
        } else {
          await completeFlow(conversation);
        }
      } else {
        // Wait for next reply (pause here)
        conversation.currentNodeId = node.id;
        await conversation.save();
      }
      break;
    }

    case 'handoff': {
      conversation.status = 'human';
      conversation.currentNodeId = null;
      await conversation.save();
      const text = "Connecting you to our team right now! ⚡ Someone will be with you shortly.";
      await sendAndSaveMessage(userId, conversation, contact, phoneNumberId, token, text, 'bot', io);
      if (io) io.to(`user_${userId}`).emit('conversation_assigned', { conversationId: conversation._id, needsAgent: true });

      // Trigger handoff notification
      const { createNotification } = require('./notificationService');
      createNotification({
        userId,
        organizationId: conversation.organization_id || (adminUser ? adminUser.organizationId : null),
        type: 'bot',
        title: `Handoff Requested: ${contact.name || contact.phone}`,
        message: `Customer is waiting for an agent takeover.`,
        link: '/dashboard/inbox'
      }).catch(err => logger.error('Failed to trigger handoff notification:', err.message));

      break;
    }

    default:
      logger.warn(`Unknown node type: ${node.type}`);
      await completeFlow(conversation);
  }
}

async function completeFlow(conversation) {
  conversation.currentNodeId = null;
  conversation.currentFlowId = null;
  conversation.status = 'waiting';
  conversation.flowVariables = new Map();
  conversation.markModified('flowVariables');
  await conversation.save();
}

async function sendAndSaveMessage(userId, conversation, contact, phoneNumberId, token, text, sentBy, io, type = 'text', extra = {}) {
  // Check if we need to send a matching image first
  if (type === 'text') {
    const matchingImg = getMatchingImage(text);
    if (matchingImg) {
      try {
        const imgResult = await whatsapp.sendImageMessage(phoneNumberId, token, contact.phone, matchingImg.url, matchingImg.caption);
        const imgMsg = await Message.create({
          userId,
          conversationId: conversation._id,
          contactId: contact._id,
          direction: 'outbound',
          type: 'image',
          content: { text: matchingImg.caption, mediaUrl: imgResult.sentUrl || matchingImg.url },
          status: imgResult.success ? 'sent' : 'failed',
          metaMessageId: imgResult.data?.messages?.[0]?.id,
          sentBy,
        });
        if (io) {
          io.to(`user_${userId}`).emit('new_message', {
            message: imgMsg.toObject(),
            contact: contact.toObject(),
            conversationId: conversation._id,
          });
        }
      } catch (err) {
        logger.error('Failed to send matching image first:', err.message);
      }
    }
  }

  const result = await whatsapp.sendTextMessage(phoneNumberId, token, contact.phone, text);
  const msg = await Message.create({
    userId,
    conversationId: conversation._id,
    contactId: contact._id,
    direction: 'outbound',
    type,
    content: { text, ...extra },
    status: result.success ? 'sent' : 'failed',
    metaMessageId: result.data?.messages?.[0]?.id,
    sentBy,
    errorDetails: result.error || undefined,
  });
  conversation.lastMessageAt = new Date();
  await conversation.save();
  if (io) {
    io.to(`user_${userId}`).emit('new_message', {
      message: msg.toObject(),
      contact: contact.toObject(),
      conversationId: conversation._id,
    });
  }
  return msg;
}

async function saveOutboundMessage(userId, conversation, contact, type, content, sentBy) {
  return Message.create({
    userId,
    conversationId: conversation._id,
    contactId: contact._id,
    direction: 'outbound',
    type,
    content,
    status: 'sent',
    sentBy,
  });
}

async function saveAndEmitMessage(userId, conversation, contact, text, sentBy, io, type, extra, apiResult) {
  // Check if we need to send a matching image first
  if (type === 'text') {
    const matchingImg = getMatchingImage(text);
    if (matchingImg) {
      try {
        const waAccount = await WhatsAppAccount.findOne({ userId, isActive: true });
        if (waAccount) {
          const token = decryptField(waAccount.accessToken);
          const phoneNumberId = waAccount.phoneNumberId;
          const imgResult = await whatsapp.sendImageMessage(phoneNumberId, token, contact.phone, matchingImg.url, matchingImg.caption);
          const imgMsg = await Message.create({
            userId,
            conversationId: conversation._id,
            contactId: contact._id,
            direction: 'outbound',
            type: 'image',
            content: { text: matchingImg.caption, mediaUrl: imgResult.sentUrl || matchingImg.url },
            status: imgResult.success ? 'sent' : 'failed',
            metaMessageId: imgResult.data?.messages?.[0]?.id,
            sentBy,
          });
          if (io) {
            io.to(`user_${userId}`).emit('new_message', {
              message: imgMsg.toObject(),
              contact: contact.toObject(),
              conversationId: conversation._id,
            });
          }
        }
      } catch (err) {
        logger.error('Failed to send matching image first in saveAndEmitMessage:', err.message);
      }
    }
  }

  const msg = await Message.create({
    userId,
    conversationId: conversation._id,
    contactId: contact._id,
    direction: 'outbound',
    type,
    content: { text, ...extra },
    status: apiResult?.success ? 'sent' : 'failed',
    metaMessageId: apiResult?.data?.messages?.[0]?.id,
    sentBy,
    errorDetails: apiResult?.error || undefined,
  });
  conversation.lastMessageAt = new Date();
  await conversation.save();
  if (io) {
    io.to(`user_${userId}`).emit('new_message', {
      message: msg.toObject(),
      contact: contact.toObject(),
      conversationId: conversation._id,
    });
  }
  return msg;
}

function interpolate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

async function runAutomations(userId, conversation, contact, savedMsg, phoneNumberId, token, io) {
  try {
    const textContent = (savedMsg.content?.text || '').toLowerCase().trim();

    // 1. Log button response if interactive
    if (savedMsg.type === 'interactive') {
      const btnId = savedMsg.content?.interactive?.id || 'button';
      const btnTitle = savedMsg.content?.interactive?.title || 'Button Click';
      await require('../models/ApiLog').create({
        userId,
        type: 'button_response',
        url: `/button-click/${btnId}`,
        statusCode: 200,
        details: `Contact ${contact.phone} clicked button: "${btnTitle}" (ID: ${btnId})`,
        requestBody: savedMsg.content?.interactive,
        responseBody: { status: 'logged' },
      });
    }

    // 2. Auto Tag Assignment
    const AutoTagRule = require('../models/AutoTagRule');
    const autoTagRules = await AutoTagRule.find({ userId, isActive: true }).lean();
    let tagsAdded = [];

    for (const rule of autoTagRules) {
      let match = false;
      if (rule.triggerType === 'keyword' && textContent.includes(rule.triggerValue.toLowerCase())) {
        match = true;
      } else if (rule.triggerType === 'source' && contact.source === rule.triggerValue) {
        match = true;
      }

      if (match) {
        const cleanTag = rule.tagToAssign.trim().toLowerCase();
        if (!contact.tags.includes(cleanTag)) {
          contact.tags.push(cleanTag);
          tagsAdded.push(cleanTag);
        }
      }
    }

    if (tagsAdded.length > 0) {
      await contact.save();
      // Auto-trigger Sequences linked to tags
      const Sequence = require('../models/Sequence');
      const SequenceExecution = require('../models/SequenceExecution');
      
      for (const tag of tagsAdded) {
        const seqs = await Sequence.find({ userId, triggerTag: tag, isActive: true }).lean();
        for (const seq of seqs) {
          if (!seq.messages || !seq.messages.length) continue;

          // Check if already running this sequence for this contact
          const existing = await SequenceExecution.findOne({ userId, contactId: contact._id, sequenceId: seq._id, status: 'running' });
          if (existing) continue;

          // Calculate delay for first step
          const firstMsg = seq.messages[0];
          let delayMs = 0;
          if (firstMsg.delayUnit === 'minutes') delayMs = firstMsg.delayValue * 60 * 1000;
          else if (firstMsg.delayUnit === 'hours') delayMs = firstMsg.delayValue * 60 * 60 * 1000;
          else delayMs = firstMsg.delayValue * 24 * 60 * 60 * 1000;

          await SequenceExecution.create({
            userId,
            sequenceId: seq._id,
            contactId: contact._id,
            nextStepIndex: 0,
            scheduledAt: new Date(Date.now() + delayMs),
            status: 'running',
          });
          logger.info(`Auto-triggered sequence ${seq.name} for contact ${contact.phone} due to tag ${tag}`);
        }
      }
    }

    // 3. Auto Team Assignment
    if (!conversation.assignedAgent) {
      const AssignmentRule = require('../models/AssignmentRule');
      const assignRules = await AssignmentRule.find({ userId, isActive: true }).sort('createdAt').lean();

      for (const rule of assignRules) {
        let match = false;
        if (rule.triggerType === 'all') {
          match = true;
        } else if (rule.triggerType === 'keyword' && textContent.includes(rule.triggerValue.toLowerCase())) {
          match = true;
        } else if (rule.triggerType === 'source' && contact.source === rule.triggerValue) {
          match = true;
        }

        if (match) {
          conversation.assignedAgent = rule.agentId;
          conversation.status = 'human';
          await conversation.save();

          if (io) {
            io.to(`user_${userId}`).emit('conversation_assigned', {
              conversationId: conversation._id,
              agentId: rule.agentId,
            });
            // Also notify the agent
            io.to(`user_${rule.agentId}`).emit('conversation_assigned', {
              conversationId: conversation._id,
              agentId: rule.agentId,
            });
          }

          // Trigger assignment notification
          const { createNotification } = require('./notificationService');
          createNotification({
            userId: rule.agentId.toString(),
            organizationId: conversation.organization_id || (adminUser ? adminUser.organizationId : null),
            type: 'team',
            title: `New Chat Assigned: ${contact.name || contact.phone}`,
            message: `Auto-assigned via active routing rules.`,
            link: '/dashboard/inbox'
          }).catch(err => logger.error('Failed to trigger assignment notification:', err.message));

          logger.info(`Auto-assigned conversation ${conversation._id} to agent ${rule.agentId}`);
          break;
        }
      }
    }

    // 4. Keyword Reply Triggers & Fallback responder
    if (conversation.status !== 'human' && !conversation.lock_status && conversation.takeover_status !== 'human') {
      const ReplyTrigger = require('../models/ReplyTrigger');
      const activeTriggers = await ReplyTrigger.find({ userId, isActive: true }).lean();
      
      // Look for keyword triggers
      const kwTriggers = activeTriggers.filter(t => !t.isFallback && t.triggerText && textContent.includes(t.triggerText.toLowerCase()));
      
      if (kwTriggers.length > 0) {
        // Execute the first matching trigger
        const trigger = kwTriggers[0];
        await sendReplyForTrigger(userId, conversation, contact, trigger, phoneNumberId, token, io);
        return true;
      }

      // If no keyword match, check if we have a fallback trigger
      const fallbackTriggers = activeTriggers.filter(t => t.isFallback);
      if (fallbackTriggers.length > 0) {
        await sendReplyForTrigger(userId, conversation, contact, fallbackTriggers[0], phoneNumberId, token, io);
        return true;
      }
    }

  } catch (err) {
    logger.error('Error in runAutomations helper:', err);
  }
  return false;
}

async function sendReplyForTrigger(userId, conversation, contact, trigger, phoneNumberId, token, io) {
  // If template is specified
  if (trigger.templateIds && trigger.templateIds.length > 0) {
    const Template = require('../models/Template');
    for (const tid of trigger.templateIds) {
      const tmpl = await Template.findById(tid);
      if (!tmpl) continue;

      const result = await whatsapp.sendTemplateMessage(phoneNumberId, token, contact.phone, tmpl.name, 'en', []);
      if (result.success) {
        // Save message
        const message = await Message.create({
          userId,
          conversationId: conversation._id,
          contactId: contact._id,
          direction: 'outbound',
          type: 'template',
          content: { template: { name: tmpl.name, variables: [] } },
          status: 'sent',
          metaMessageId: result.data?.messages?.[0]?.id,
          sentBy: 'system',
        });
        conversation.lastMessageAt = new Date();
        await conversation.save();

        if (io) {
          io.to(`user_${userId}`).emit('new_message', {
            message: message.toObject(),
            contact: contact.toObject(),
            conversationId: conversation._id,
          });
        }
      }
    }
  }

  // If text reply is specified
  if (trigger.replyText) {
    await sendAndSaveMessage(userId, conversation, contact, phoneNumberId, token, trigger.replyText, 'system', io);
  }
}

function getMatchingImage(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  
  // Rides & attractions
  if (lower.includes('entrance') || lower.includes('પ્રવેશ') || lower.includes('એન્ટ્રન્સ')) return { url: 'https://images.unsplash.com/photo-1582650625119-3a31f8fa2699?w=800&auto=format&fit=crop', caption: 'Chab Chabba Chab Entrance 🌊' };
  if (lower.includes('wave pool') || lower.includes('વેવ પૂલ')) return { url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop', caption: 'Wave Pool 🌊' };
  if (lower.includes('rain dance') || lower.includes('રેઈન ડાન્સ')) return { url: 'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=800&auto=format&fit=crop', caption: 'Rain Dance Area 💃🚿' };
  if (lower.includes('kids zone') || lower.includes('kids splash') || lower.includes('splash zone') || lower.includes('બાળકો') || lower.includes('કિડ્સ')) return { url: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=800&auto=format&fit=crop', caption: 'Kids Zone 🧸💦' };
  if (lower.includes('family pool') || lower.includes('family activity') || lower.includes('family pool experience') || lower.includes('ફેમિલી')) return { url: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&auto=format&fit=crop', caption: 'Family Activity Pool 👨‍👩‍👧‍👦🏊' };
  if (lower.includes('slide') || lower.includes('ride') || lower.includes('spiral') || lower.includes('રાઇડ') || lower.includes('સ્લાઇડ')) return { url: 'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=800&auto=format&fit=crop', caption: 'Giant Water Slides 🎢💦' };
  
  // Rooms
  if (lower.includes('deluxe') || lower.includes('splashy deluxe') || lower.includes('ડીલક્સ') || lower.includes('ડેલક્સ')) return { url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&auto=format&fit=crop', caption: 'Splashy Deluxe Room 🏨' };
  if (lower.includes('villa') || lower.includes('marine villa') || lower.includes('વિલા')) return { url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop', caption: 'Marine Villa AC Room 🏡' };
  if (lower.includes('cabana') || lower.includes('luxury cabana') || lower.includes('કેબાના')) return { url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop', caption: 'Luxury Cabana 🏖️' };
  if (lower.includes('stay') || lower.includes('room') || lower.includes('રૂમ') || lower.includes('રોકાણ')) return { url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&auto=format&fit=crop', caption: 'Family Stay Room 🛏️' };

  // Costumes & Lockers
  if (lower.includes('costume') || lower.includes('dress') || lower.includes('swimwear') || lower.includes('કોસ્ટ્યુમ') || lower.includes('કપડાં') || lower.includes('ડ્રેસ') || lower.includes('સ્વિમવેર')) return { url: 'https://images.unsplash.com/photo-1564859228273-274232fdb516?w=800&auto=format&fit=crop', caption: 'Water Park Swimwear & Costumes 🩱🩳' };
  if (lower.includes('locker') || lower.includes('changing') || lower.includes('લોકર')) return { url: 'https://images.unsplash.com/photo-1574634534894-89d7576c8259?w=800&auto=format&fit=crop', caption: 'Locker Area & Changing Rooms 🔒' };

  // Food
  if (lower.includes('food') || lower.includes('lunch') || lower.includes('meal') || lower.includes('restaurant') || lower.includes('ભોજન') || lower.includes('ખોરાક') || lower.includes('લંચ') || lower.includes('મેનુ')) return { url: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&auto=format&fit=crop', caption: 'Delicious Food at Our Food Court 🍲' };
  if (lower.includes('chole') || lower.includes('છોલે')) return { url: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=800&auto=format&fit=crop', caption: 'Chole Puri 🍛' };
  if (lower.includes('pav bhaji') || lower.includes('પાવભાજી') || lower.includes('પાવ ભાજી')) return { url: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&auto=format&fit=crop', caption: 'Pav Bhaji 🍛' };
  if (lower.includes('manchurian') || lower.includes('મંચુરિયન')) return { url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop', caption: 'Manchurian 🍜' };
  if (lower.includes('biryani') || lower.includes('બિરયાની')) return { url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop', caption: 'Veg Biryani 🍚' };
  if (lower.includes('noodles') || lower.includes('નૂડલ્સ')) return { url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop', caption: 'Noodles 🍝' };

  // Group Trips
  if (lower.includes('school') || lower.includes('student') || lower.includes('શાળા') || lower.includes('વિદ્યાર્થી') || lower.includes('સ્કૂલ')) return { url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&auto=format&fit=crop', caption: 'School Trips Group 🎒' };
  if (lower.includes('college') || lower.includes('university') || lower.includes('educational') || lower.includes('કોલેજ') || lower.includes('યુનિવર્સિટી')) return { url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop', caption: 'College Outing Group 🎓' };
  if (lower.includes('corporate') || lower.includes('company') || lower.includes('team') || lower.includes('કોર્પોરેટ') || lower.includes('કંપની')) return { url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&auto=format&fit=crop', caption: 'Corporate Team Outing 👔' };

  // Gallery / Location
  if (lower.includes('gallery') || lower.includes('attractions') || lower.includes('ગેલેરી') || lower.includes('આકર્ષણ') || lower.includes('આકર્ષણો') || lower.includes('ફોટા') || lower.includes('તસવીરો')) return { url: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&auto=format&fit=crop', caption: 'Water Park View 🎡' };
  if (lower.includes('ticket') || lower.includes('price') || lower.includes('counter') || lower.includes('ટિકિટ') || lower.includes('દર') || lower.includes('ભાવ')) return { url: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&auto=format&fit=crop', caption: 'Ticket Counter 🎟️' };

  return null;
}

module.exports = { processIncomingMessage };
