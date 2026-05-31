const env = require('../config/env');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Helper to initialize the correct AI Client based on organization preferences or environment fallback.
 */
async function getAIClient(provider, org) {
  const { decryptField } = require('./encryption');
  
  const customOpenAIKey = org?.aiConfig?.openaiApiKey ? decryptField(org.aiConfig.openaiApiKey) : null;
  const customGrokKey = org?.aiConfig?.grokApiKey ? decryptField(org.aiConfig.grokApiKey) : null;

  const finalOpenAIKey = (customOpenAIKey && customOpenAIKey.trim() !== '') ? customOpenAIKey.trim() : env.OPENAI_API_KEY;
  const finalGrokKey = (customGrokKey && customGrokKey.trim() !== '') ? customGrokKey.trim() : env.GROK_API_KEY;

  let clientOptions = {};
  let modelName = 'gpt-4o-mini'; // default cheaper model for fast copilot

  if (provider === 'grok') {
    const hasGrok = finalGrokKey && finalGrokKey !== 'your_grok_api_key' && finalGrokKey.trim() !== '';
    if (hasGrok) {
      const isGroq = finalGrokKey.trim().startsWith('gsk_');
      if (isGroq) {
        clientOptions = {
          apiKey: finalGrokKey.trim(),
          baseURL: 'https://api.groq.com/openai/v1'
        };
        modelName = 'llama-3.1-8b-instant';
      } else {
        clientOptions = {
          apiKey: finalGrokKey.trim(),
          baseURL: 'https://api.x.ai/v1'
        };
        modelName = 'grok-2';
      }
    } else {
      throw new Error('xAI Grok key is not configured.');
    }
  } else {
    // Default to OpenAI
    const hasOpenAI = finalOpenAIKey && finalOpenAIKey !== 'your_openai_api_key' && finalOpenAIKey.trim() !== '';
    if (hasOpenAI) {
      clientOptions = { apiKey: finalOpenAIKey };
      modelName = 'gpt-4o'; // high quality model for drafts
    } else {
      throw new Error('OpenAI key is not configured.');
    }
  }

  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI(clientOptions);

  return { openai, modelName };
}

/**
 * Generate a reply draft based on conversation history and customer profile.
 */
async function generateDraft(messageHistory, contact, provider = 'openai', org = null) {
  try {
    const { openai, modelName } = await getAIClient(provider, org);

    const systemPrompt = `You are an expert customer service AI Copilot assisting a human support agent.
Your goal is to draft a helpful, accurate, and concise response to the customer.
Read the recent message logs and the customer's details, then provide a single draft response.

Rules:
- Be warm, helpful, and highly professional.
- Do NOT add agent instructions, metadata, or placeholders. Return ONLY the drafted message.
- Keep the draft relatively short and readable for a WhatsApp chat.
- Leverage customer profile variables if available (e.g. name).

Customer Name: ${contact.name || 'Customer'}
Customer Phone: ${contact.phone || 'Unknown'}`;

    const messages = [{ role: 'system', content: systemPrompt }];

    for (const msg of messageHistory) {
      messages.push({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content?.text || '[media or attachments]',
      });
    }

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: 400,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'No draft could be generated.';
  } catch (err) {
    logger.error('Copilot Draft error:', err.message);
    throw err;
  }
}

/**
 * Rewrite a draft message in a specific tone.
 */
async function changeTone(text, tone, provider = 'openai', org = null) {
  try {
    const { openai, modelName } = await getAIClient(provider, org);

    const tonePrompts = {
      professional: 'highly professional, business-appropriate, elegant and polished.',
      friendly: 'warm, highly enthusiastic, polite, and conversational.',
      sales: 'persuasive, highly engaging, emphasizing value, and clear call-to-actions.',
      urgent: 'assertive, emphasizing immediate timeline, time-sensitive and action-oriented.',
      empathetic: 'deeply understanding, caring, validating the user\'s feelings and highly supportive.',
      technical: 'detailed, precise, professional, containing accurate operational steps.'
    };

    const targetTone = tonePrompts[tone] || tonePrompts.professional;

    const messages = [
      {
        role: 'system',
        content: `You are an expert copywriting assistant.
Rewrite the user's message to match this tone: ${targetTone}
Ensure you do NOT change any critical factual information (like dates, links, names, prices). Only rewrite the phrasing.
Return ONLY the rewritten message with no preambles or explanations.`
      },
      { role: 'user', content: text }
    ];

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: 400,
      temperature: 0.6,
    });

    return completion.choices[0]?.message?.content || text;
  } catch (err) {
    logger.error('Copilot Tone change error:', err.message);
    throw err;
  }
}

/**
 * Translate text into another language.
 */
async function translateText(text, targetLanguage, provider = 'openai', org = null) {
  try {
    const { openai, modelName } = await getAIClient(provider, org);

    const messages = [
      {
        role: 'system',
        content: `You are an expert multilingual translator.
Translate the user's text into this language: ${targetLanguage}.
Maintain conversational spacing, styling (e.g. bold marks if present), and tone.
Do not translate names, telephone numbers, links, or variables.
Return ONLY the translated text.`
      },
      { role: 'user', content: text }
    ];

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: 500,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || text;
  } catch (err) {
    logger.error('Copilot Translation error:', err.message);
    throw err;
  }
}

/**
 * Generate summaries (Quick, Detailed, Key Issues, Action Items) for a conversation.
 */
async function summarizeConversation(messageHistory, summaryType = 'quick', org = null) {
  try {
    // Summaries default to openai for reliability
    const { openai, modelName } = await getAIClient('openai', org);

    let promptDetail = '';
    if (summaryType === 'detailed') {
      promptDetail = 'Provide a comprehensive breakdown of the entire conversation thread chronologically.';
    } else if (summaryType === 'issues') {
      promptDetail = 'Highlight only the key issues, grievances, or queries raised by the customer.';
    } else if (summaryType === 'actions') {
      promptDetail = 'Identify concrete next action items and follow-ups required by the agent.';
    } else {
      promptDetail = 'Provide a brief, 2-3 sentence overview of the conversation.';
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert conversation analyst.
Read the message history and generate an expert summary.
Instruction: ${promptDetail}
Return the summary as clean markdown formatting.`
      }
    ];

    const historyStr = messageHistory.map(m => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.content?.text || '[Attachment]'}`).join('\n');
    messages.push({ role: 'user', content: historyStr });

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: 500,
      temperature: 0.5,
    });

    return completion.choices[0]?.message?.content || 'Summary not available.';
  } catch (err) {
    logger.error('Copilot Summary error:', err.message);
    throw err;
  }
}

/**
 * Suggest smart replies or knowledge-base options based on history.
 */
async function getSmartSuggestions(messageHistory, contact, org = null) {
  try {
    const { openai, modelName } = await getAIClient('openai', org);

    const historyStr = messageHistory.slice(-5).map(m => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.content?.text || '[Attachment]'}`).join('\n');

    const messages = [
      {
        role: 'system',
        content: `You are an expert AI support supervisor.
Based on the latest messages in this chat, provide exactly 3 short, conversational, and helpful suggested quick-replies that the agent can click to reply to the customer.
Format output as a JSON array of strings, e.g. ["Hello! How can I help you today?", "Sure, here are our pricing options.", "I will connect you with technical support."].
Return ONLY the JSON array and absolutely no markdown formatting tags.`
      },
      { role: 'user', content: historyStr }
    ];

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: 200,
      temperature: 0.5,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    try {
      return JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch {
      return [];
    }
  } catch (err) {
    logger.error('Copilot Suggestions error:', err.message);
    return [];
  }
}

module.exports = {
  generateDraft,
  changeTone,
  translateText,
  summarizeConversation,
  getSmartSuggestions
};
