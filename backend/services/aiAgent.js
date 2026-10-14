const env = require('../config/env');
const winston = require('winston');
const axios = require('axios');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const { decryptField } = require('./encryption');
const whatsapp = require('./whatsapp');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const PROVIDER_SPECS = {
  groq: {
    name: 'Groq Cloud',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-8b-instant',
    fallbackModel: 'llama-3.3-70b-versatile'
  },
  gemini: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-1.5-flash',
    fallbackModel: 'gemini-2.0-flash'
  },
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    fallbackModel: 'gpt-3.5-turbo'
  },
  anthropic: {
    name: 'Anthropic Claude',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    fallbackModel: 'claude-3-5-haiku-20241022'
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    fallbackModel: 'deepseek-reasoner'
  },
  xai: {
    name: 'xAI (Grok)',
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    fallbackModel: 'grok-beta'
  },
  mistral: {
    name: 'Mistral AI',
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    fallbackModel: 'mistral-small-latest'
  },
  perplexity: {
    name: 'Perplexity AI',
    baseURL: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
    fallbackModel: 'sonar-pro'
  },
  openrouter: {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    fallbackModel: 'google/gemini-2.0-flash-exp:free'
  },
  cohere: {
    name: 'Cohere',
    baseURL: 'https://api.cohere.com/v2',
    defaultModel: 'command-r-plus-08-2024',
    fallbackModel: 'command-r-08-2024'
  },
  custom: {
    name: 'Custom / Self-Hosted',
    baseURL: '',
    defaultModel: 'default',
    fallbackModel: ''
  }
};

/**
 * Resolve the active AI API key and provider configuration.
 * STRICT RULE: No default API key is used!
 * The AI is ONLY active if the Admin/Superadmin explicitly enters & saves an API key in Settings.
 */
function resolveAIConfig(org = null) {
  if (!org || !org.aiConfig) {
    return null;
  }

  if (org.aiConfig.isEnabled === false) {
    return null;
  }

  const provider = (org.aiConfig.provider || '').toLowerCase().trim();
  if (!provider) {
    return null;
  }

  let rawKey = '';
  // Check provider-specific fields, map, or active key
  const mapKey = org.aiConfig.apiKeys?.get ? org.aiConfig.apiKeys.get(provider) : org.aiConfig.apiKeys?.[provider];
  const fieldKey = org.aiConfig[`${provider}ApiKey`] || (provider === 'xai' ? org.aiConfig.grokApiKey : '');
  const encKey = mapKey || fieldKey || org.aiConfig.activeApiKey || '';

  if (encKey) {
    rawKey = decryptField(encKey);
  }

  if (!rawKey || !rawKey.trim()) {
    if (provider === 'custom' && org.aiConfig.customBaseUrl?.trim()) {
      rawKey = 'custom-no-key';
    } else {
      return null; // No key configured in Settings -> AI remains inactive
    }
  }

  const apiKey = rawKey.trim();
  const spec = PROVIDER_SPECS[provider] || {
    name: provider,
    baseURL: org.aiConfig.customBaseUrl || '',
    defaultModel: 'default',
    fallbackModel: ''
  };

  const customModel = org.aiConfig.model?.trim();
  const systemPrompt = org.aiConfig.systemPrompt?.trim() || '';
  const temperature = typeof org.aiConfig.temperature === 'number' ? org.aiConfig.temperature : 0.7;
  const baseURL = provider === 'custom'
    ? (org.aiConfig.customBaseUrl || '').replace(/\/+$/, '')
    : spec.baseURL;

  // AUTO-SANITIZE Groq model: sanitize deprecated models to llama-3.1-8b-instant
  let chosenModel = customModel || spec.defaultModel;
  if (provider === 'groq') {
    const deprecatedGroqModels = ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'];
    if (!chosenModel || deprecatedGroqModels.includes(chosenModel)) {
      chosenModel = 'llama-3.1-8b-instant';
      if (org && org.aiConfig && org.aiConfig.model !== chosenModel) {
        org.aiConfig.model = chosenModel;
        org.save().catch(() => {});
      }
    }
  }

  return {
    provider,
    apiKey,
    baseURL,
    model: chosenModel,
    fallbackModel: spec.fallbackModel || spec.defaultModel,
    systemPrompt,
    temperature
  };
}

/**
 * Direct Anthropic Claude API caller
 */
async function callAnthropicDirect(apiKey, model, messages, temperature = 0.7, max_tokens = 600) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  const formattedMessages = chatMsgs.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content || ''
  }));

  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: model || 'claude-3-5-sonnet-20241022',
      max_tokens: max_tokens || 600,
      temperature: Math.min(Math.max(temperature, 0), 1),
      system: systemMsg?.content || undefined,
      messages: formattedMessages
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      timeout: 30000
    }
  );

  return res.data?.content?.[0]?.text || '';
}

/**
 * Direct Gemini REST API caller (fallback if OpenAI compatibility endpoint is unreachable)
 */
async function callGeminiDirect(apiKey, model, messages, temperature = 0.7, max_tokens = 600) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  const contents = chatMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '' }]
  }));

  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: max_tokens
    }
  };

  if (systemMsg?.content) {
    body.system_instruction = {
      parts: [{ text: systemMsg.content }]
    };
  }

  const targetModel = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

  const res = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Call Chat Completions API with multi-provider and automatic fallback support.
 */
async function callChatCompletions(config, messages, temperature = 0.7, max_tokens = 600) {
  // 1. Anthropic Claude
  if (config.provider === 'anthropic') {
    return await callAnthropicDirect(config.apiKey, config.model, messages, temperature, max_tokens);
  }

  // 2. Google Gemini
  if (config.provider === 'gemini') {
    try {
      const res = await axios.post(
        `${config.baseURL}/chat/completions`,
        {
          model: config.model,
          messages,
          temperature,
          max_tokens
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      return res.data?.choices?.[0]?.message?.content || '';
    } catch (geminiOpenAIErr) {
      logger.warn(`Gemini OpenAI-compatible endpoint failed (${geminiOpenAIErr.message}), falling back to Gemini native REST...`);
      return await callGeminiDirect(config.apiKey, config.model, messages, temperature, max_tokens);
    }
  }

  // 3. OpenAI-Compatible Providers (Groq, OpenAI, DeepSeek, xAI, Mistral, Perplexity, OpenRouter, Cohere, Custom)
  const headers = {
    'Content-Type': 'application/json'
  };
  if (config.apiKey && config.apiKey !== 'custom-no-key') {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  try {
    const res = await axios.post(
      `${config.baseURL}/chat/completions`,
      {
        model: config.model,
        messages,
        temperature,
        max_tokens
      },
      {
        headers,
        timeout: 30000
      }
    );
    return res.data?.choices?.[0]?.message?.content || '';
  } catch (primaryErr) {
    const primaryErrMsg = primaryErr.response?.data?.error?.message || primaryErr.response?.data?.error || primaryErr.message;
    logger.warn(`Primary model ${config.model} for ${config.provider} failed: ${primaryErrMsg}. Retrying fallback models...`);

    // Dynamic candidate fallback list
    const candidateFallbacks = [];
    if (config.fallbackModel && config.fallbackModel !== config.model) {
      candidateFallbacks.push(config.fallbackModel);
    }
    if (config.provider === 'groq') {
      ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it'].forEach(m => {
        if (!candidateFallbacks.includes(m) && m !== config.model) candidateFallbacks.push(m);
      });
    }

    for (const fbModel of candidateFallbacks) {
      try {
        const fallbackRes = await axios.post(
          `${config.baseURL}/chat/completions`,
          {
            model: fbModel,
            messages,
            temperature,
            max_tokens
          },
          {
            headers,
            timeout: 30000
          }
        );
        logger.info(`Fallback succeeded with model ${fbModel} for provider ${config.provider}`);
        return fallbackRes.data?.choices?.[0]?.message?.content || '';
      } catch (fbErr) {
        const fbErrMsg = fbErr.response?.data?.error?.message || fbErr.response?.data?.error || fbErr.message;
        logger.warn(`Fallback model ${fbModel} failed: ${fbErrMsg}`);
      }
    }

    throw primaryErr;
  }
}

/**
 * Generate intelligent WhatsApp response using Groq AI.
 * Distinguishes between new customers (warm welcome) vs existing customers (chat history context).
 */
async function generateAIResponse({ conversation, contact, incomingText = '', org = null, userId }) {
  try {
    const config = resolveAIConfig(org);
    if (!config) {
      return {
        text: "I'm currently unable to connect to the AI service. Let me connect you with our team right away! ⚡",
        handoff: true
      };
    }

    // 1. Fetch recent message history (chronological) with OEK decryption
    const rawHistory = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(15);
    const { getOekForUser, decryptMessage } = require('./oekService');
    const rawOek = await getOekForUser(userId);
    const history = (rawHistory || []).map(m => {
      try {
        return rawOek ? decryptMessage(m, rawOek) : m;
      } catch (_) {
        return m;
      }
    });
    history.reverse();

    // 2. Determine if customer is new or existing
    // Count user messages in this chat
    const userMsgCount = history.filter(m => m.direction === 'inbound').length;
    const isNew = userMsgCount <= 1 && (contact.totalMessages || 0) <= 1;

    // 3. Fetch Product Catalog for contextual business queries
    let catalogSnippet = '';
    try {
      const Product = require('../models/Product');
      const products = await Product.find({ userId, isArchived: { $ne: true } })
        .select('name price discountPrice status description')
        .limit(12)
        .lean();

      if (products && products.length > 0) {
        catalogSnippet = 'BUSINESS CATALOG / PRODUCTS:\n' + products.map(p =>
          `- ${p.name}: ₹${p.discountPrice || p.price} (${p.status === 'in_stock' ? 'In Stock' : 'Low Stock/Order'}) ${p.description ? '— ' + p.description.slice(0, 80) : ''}`
        ).join('\n');
      }
    } catch (_) {}

    const orgName = org?.name || 'HK Digiverse';
    const contactName = contact?.name || 'Customer';
    const contactPhone = contact?.phone || '';
    const contactTags = Array.isArray(contact?.tags) ? contact.tags.join(', ') : '';
    const contactNotes = contact?.notes || '';

    // 4. Construct high-intelligence system prompt
    const systemPrompt = `You are the professional, friendly, and helpful WhatsApp AI Assistant for "${orgName}".
You chat directly with customers on WhatsApp in real time.

CUSTOMER PROFILE:
- Name: ${contactName}
- Phone: ${contactPhone}
${contactTags ? `- Tags: ${contactTags}\n` : ''}${contactNotes ? `- Notes: ${contactNotes}\n` : ''}
${catalogSnippet ? `\n${catalogSnippet}\n` : ''}

CONVERSATION MODE:
${isNew 
  ? `[NEW CUSTOMER]: This is their very first interaction with us. 
- Greet them warmly and introduce yourself politely as the AI Assistant for ${orgName}.
- Inquire how you can assist them with services, products, bookings, or inquiries today.`
  : `[EXISTING CUSTOMER]: This is an active conversation with ongoing history.
- DO NOT repeat introductory welcoming scripts or "Welcome to ${orgName}".
- Continue naturally from previous context and directly answer their latest question.`}

CRITICAL LANGUAGE & COMMUNICATION RULES (STRICT ENFORCEMENT):
1. ACCURATE LANGUAGE MATCHING:
   - You MUST detect the language and script of the customer's LATEST message and reply in that EXACT SAME language:
   - ENGLISH: If the customer writes in English (e.g. "hello", "which service you provide", "i am interested", "what are your ticket rates?"), you MUST reply 100% in fluent, polished English! NEVER start with "Namaste" or write in Hindi/Hinglish when the customer asks in English!
   - HINDI / HINGLISH: If the customer writes in Hindi or Hinglish (e.g. "namaste", "aap kya kya service dete ho", "ticket kitne ki he"), reply warmly in natural Hindi / Hinglish.
   - GUJARATI: If the customer writes in Gujarati (e.g. "kem cho", "tamari service shu che"), reply in polite Gujarati.
2. DYNAMIC & CONTEXTUAL RESPONSES (NO CANNED TEMPLATES):
   - Analyze the customer's actual query and answer intelligently using the business catalog and profile.
   - If they ask "which service you provide", describe the actual attractions, rides, wave pools, services, or packages of ${orgName}.
   - If they say "i am interested", enthusiastically ask what specifically they are interested in (e.g. day tickets, group discounts, event bookings) and provide actionable details.
3. WHATSAPP FORMATTING:
   - Use short, readable paragraphs (1-3 sentences) or neat bullet points.
   - Use tasteful emojis (✨, 🌊, 🎟️, 👍) naturally without overdoing them.
${config.systemPrompt ? `\nADDITIONAL BUSINESS INSTRUCTIONS FROM ADMIN:\n${config.systemPrompt}\n` : ''}`;

    // 5. Build cleaned, strictly alternating messages array
    const rawHistoryItems = [];
    for (const msg of history) {
      const text = (msg.content?.text || (msg.type !== 'text' ? `[${msg.type} message]` : '')).trim();
      if (!text) continue;
      // Filter out system error/fallback strings so AI doesn't echo or replicate them
      if (text.includes("trouble right now") || text.includes("assist you shortly")) continue;
      if (text.includes("Namaste! 🙏 Welcome to") && text.includes("Main aapki kya sahayata")) continue;
      if (text.includes("Namaste! 🙏 Thank you for messaging") && text.includes("How can I assist you today?")) continue;

      const role = msg.direction === 'inbound' ? 'user' : 'assistant';
      rawHistoryItems.push({ role, content: text });
    }

    // Ensure latest incoming text is present as the final user message
    if (incomingText && incomingText.trim()) {
      const cleanIncoming = incomingText.trim();
      const lastItem = rawHistoryItems[rawHistoryItems.length - 1];
      if (!lastItem || lastItem.role !== 'user' || lastItem.content !== cleanIncoming) {
        rawHistoryItems.push({ role: 'user', content: cleanIncoming });
      }
    }

    // Consolidate consecutive messages with the same role (e.g. user + user -> user)
    // Prevents 400 Bad Request error on Groq, Anthropic, and OpenAI endpoints
    const alternatingMessages = [];
    for (const item of rawHistoryItems) {
      if (alternatingMessages.length > 0 && alternatingMessages[alternatingMessages.length - 1].role === item.role) {
        alternatingMessages[alternatingMessages.length - 1].content += `\n${item.content}`;
      } else {
        alternatingMessages.push({ ...item });
      }
    }

    // Ensure history starts with a user message
    while (alternatingMessages.length > 0 && alternatingMessages[0].role !== 'user') {
      alternatingMessages.shift();
    }

    if (alternatingMessages.length === 0 && incomingText && incomingText.trim()) {
      alternatingMessages.push({ role: 'user', content: incomingText.trim() });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...alternatingMessages
    ];

    let reply = '';
    try {
      reply = await callChatCompletions(config, messages, config.temperature ?? 0.7);
    } catch (llmErr) {
      const errDetails = llmErr.response?.data?.error?.message || llmErr.response?.data?.error || llmErr.message;
      logger.error('callChatCompletions failed in generateAIResponse:', errDetails);

      const inText = (incomingText || '').trim();
      const isEnglish = /^[a-zA-Z0-9\s.,!?'"()\-&]+$/.test(inText);
      const lower = inText.toLowerCase();

      if (isEnglish) {
        if (/^(hi|hello|hey|good\s*(morning|afternoon|evening))/i.test(lower)) {
          reply = `Hello! 👋 Welcome to ${orgName}. How can I assist you today? ✨`;
        } else if (lower.includes('service') || lower.includes('provide') || lower.includes('what do you')) {
          reply = `At ${orgName}, we offer complete water park entertainment including thrilling water slides, a giant wave pool, rain dance, family rides, delicious food options, and party packages! 🌊 How can I help you plan your visit? ✨`;
        } else if (lower.includes('interested') || lower.includes('book') || lower.includes('ticket')) {
          reply = `That's great! 🎟️ Are you looking for entry tickets, family packages, or group bookings at ${orgName}? Let me know and I'll share all the details! 👍`;
        } else {
          reply = `Hello! 👋 Thank you for messaging ${orgName}. How can I assist you with our services today? ✨`;
        }
      } else {
        // Hindi / Hinglish / Gujarati
        if (/^(namaste|pranam|ram ram|kem cho)/i.test(lower)) {
          reply = `Namaste! 🙏 ${orgName} mein aapka swagat hai. Main aapki kya sahayata kar sakta hoon? ✨`;
        } else if (lower.includes('service') || lower.includes('kya') || lower.includes('su')) {
          reply = `${orgName} mein hum thrilling water slides, wave pool, rain dance, family rides aur event packages provide karte hain. 🌊 Aap kis bare mein jankari chahte hain? ✨`;
        } else if (lower.includes('interested') || lower.includes('ticket') || lower.includes('book') || lower.includes('price')) {
          reply = `Bahut badiya! 🎟️ Aap ${orgName} ke ticket prices, family packages ya group booking mein se kis bare mein janna chahte hain? Main aapko sari details bata deta hoon. 👍`;
        } else {
          reply = `Namaste! 🙏 ${orgName} mein contact karne ke liye dhanyawad. Main aapki kya madad kar sakta hoon? ✨`;
        }
      }
    }

    const cleanedText = (reply || '').replace(/\[HANDOFF\]/gi, '').replace(/^HANDOFF:?/i, '').trim();

    return {
      text: cleanedText || (isEnglish ? `Hello! Welcome to ${orgName}. How can I help you today? ✨` : `Namaste! 🙏 ${orgName} mein aapka swagat hai. Main aapki kya sahayata kar sakta hoon? ✨`),
      handoff: false
    };
  } catch (error) {
    logger.error('generateAIResponse error:', error.message);
    const inText = (incomingText || '').trim();
    const isEnglish = /^[a-zA-Z0-9\s.,!?'"()\-&]+$/.test(inText);
    return {
      text: isEnglish ? `Hello! Welcome to ${org?.name || 'our service'}. How can I assist you today? ✨` : `Namaste! 🙏 Welcome. Main aapki kya sahayata kar sakta hoon? ✨`,
      handoff: false
    };
  }
}

/**
 * Automate generating and sending an AI response to a contact on WhatsApp,
 * saving the message to DB and emitting via Socket.io for live chat reflection.
 */
async function triggerAIReply({ conversationId, userId, io, incomingText = '', incomingMessage = null }) {
  try {
    const fs = require('fs');
    const path = require('path');
    const traceLogPath = path.join(__dirname, '../../ai-trace.log');

    let conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
      conversation = await Conversation.findById(conversationId);
    }
    if (!conversation) {
      try { fs.appendFileSync(traceLogPath, `[${new Date().toISOString()}] ERROR: Conversation ${conversationId} not found in triggerAIReply\n`); } catch (_) {}
      logger.warn(`triggerAIReply: Conversation ${conversationId} not found`);
      return null;
    }

    const effectiveUserId = conversation.userId || userId;
    const contact = await Contact.findById(conversation.contactId);
    if (!contact) {
      try { fs.appendFileSync(traceLogPath, `[${new Date().toISOString()}] ERROR: Contact ${conversation.contactId} not found\n`); } catch (_) {}
      logger.warn(`triggerAIReply: Contact not found for conversation ${conversationId}`);
      return null;
    }

    const User = require('../models/User');
    const Organization = require('../models/Organization');
    const userDoc = await User.findById(effectiveUserId);
    let org = userDoc?.organizationId ? await Organization.findById(userDoc.organizationId) : null;
    if (!org && conversation.organization_id) {
      org = await Organization.findById(conversation.organization_id);
    }
    if (!org) {
      org = await Organization.findOne();
    }

    // Use incomingText or extract from latest inbound message
    let promptText = incomingText;
    if (!promptText) {
      const lastInbound = await Message.findOne({
        conversationId: conversation._id,
        direction: 'inbound'
      }).sort({ createdAt: -1 });
      promptText = lastInbound?.content?.text || '';
    }

    // Generate AI response
    const aiResult = await generateAIResponse({
      conversation,
      contact,
      incomingText: promptText,
      org,
      userId
    });

    // Check for Meta WhatsApp credentials
    const waAccount = await WhatsAppAccount.findOne({ userId, isActive: true });
    let token = null;
    if (waAccount && waAccount.accessToken) {
      token = decryptField(waAccount.accessToken);
    }

    // STRICT: In Ask AI mode, human and bot remain completely OFF.
    // Never switch to human unless human explicitly clicks 'Take Over'.
    conversation.status = 'ai';
    conversation.lock_status = true;
    conversation.ai_active = true;
    conversation.takeover_status = 'ai';
    conversation.assignedAgent = null;
    conversation.assigned_agent_id = null;
    await conversation.save();

    if (io) {
      const payload = {
        conversationId: conversation._id,
        status: 'ai',
        ai_active: true,
        lock_status: true,
        takeover_status: 'ai',
        assignedAgent: null,
        assigned_agent_id: null
      };
      const roomId = userDoc?.ownerId ? `user_${userDoc.ownerId}` : `user_${userId}`;
      io.to(roomId).emit('conversation_assigned', payload);
      io.to(roomId).emit('ai_mode_updated', payload);
    }

    // Send AI reply via WhatsApp if account is configured
    let metaResult = null;
    if (waAccount && waAccount.phoneNumberId && token && contact.phone) {
      try {
        metaResult = await whatsapp.sendTextMessage(
          waAccount.phoneNumberId,
          token,
          contact.phone,
          aiResult.text
        );
      } catch (sendErr) {
        logger.error('Failed to send AI message to WhatsApp Meta API:', sendErr.message);
        try { fs.appendFileSync(traceLogPath, `[${new Date().toISOString()}] META_SEND_ERROR: ${sendErr.message}\n`); } catch (_) {}
      }
    }

    try {
      fs.appendFileSync(traceLogPath, `[${new Date().toISOString()}] AI_REPLY_SENT: phone=${contact.phone}, success=${Boolean(metaResult?.success)}, reply="${aiResult.text.substring(0, 60)}..."\n`);
    } catch (_) {}

    // Save AI outbound message in DB
    const aiMessage = await Message.create({
      userId: effectiveUserId,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'outbound',
      type: 'text',
      content: { text: aiResult.text },
      status: metaResult?.success ? 'sent' : 'sent',
      metaMessageId: metaResult?.data?.messages?.[0]?.id,
      sentBy: 'ai',
      errorDetails: metaResult?.error || undefined,
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Emit live message to Socket.io for immediate UI reflection in ChatWindow
    if (io) {
      const { getOekForUser, decryptMessage } = require('./oekService');
      const rawOek = await getOekForUser(userId);
      const decryptedMsg = decryptMessage(aiMessage, rawOek);
      io.to(`user_${userId}`).emit('new_message', {
        message: decryptedMsg,
        contact: contact.toObject(),
        conversationId: conversation._id,
      });
    }

    return aiMessage;
  } catch (error) {
    logger.error('triggerAIReply error:', error);
    return null;
  }
}

/**
 * Backward compatibility wrapper for previous processWithAI callers.
 */
async function processWithAI(messageHistory, contact, userMessage, customPrompt = '', org = null) {
  try {
    const config = resolveAIConfig(org);
    if (!config) {
      return { text: "I'm sorry, AI assistant is not configured. Let me connect you with a team member.", handoff: true };
    }

    let systemPrompt = customPrompt || `You are a helpful WhatsApp business assistant.
Customer name: ${contact.name || 'there'}
Customer phone: ${contact.phone || 'unknown'}`;

    const messages = [{ role: 'system', content: systemPrompt }];
    for (const msg of messageHistory) {
      messages.push({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content?.text || '[media message]',
      });
    }
    if (userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    const reply = await callChatCompletions(config, messages);
    if (reply.toUpperCase().startsWith('HANDOFF')) {
      return { text: '', handoff: true };
    }
    return { text: reply, handoff: false };
  } catch (err) {
    logger.error('processWithAI error:', err.message);
    return { text: "I'm having trouble right now. Let me connect you with our team.", handoff: true };
  }
}

module.exports = {
  resolveAIConfig,
  generateAIResponse,
  triggerAIReply,
  processWithAI
};
