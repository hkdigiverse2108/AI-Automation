const env = require('../config/env');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Process a conversation with OpenAI GPT-4.
 * @param {Array} messageHistory - last N messages
 * @param {Object} contact - contact info
 * @param {string} userMessage - latest user message
 * @param {string} customPrompt - optional custom system prompt
 * @returns {{ text: string, handoff: boolean }}
 */
async function processWithAI(messageHistory, contact, userMessage, customPrompt = '', org = null) {
  try {
    let clientOptions = {};
    let modelName = 'gpt-4';

    // Resolve custom dynamic key from database configuration
    const { decryptField } = require('./encryption');
    
    // Decrypt key if present
    const customGrokKey = org?.aiConfig?.grokApiKey ? decryptField(org.aiConfig.grokApiKey) : null;
    const finalGrokKey = (customGrokKey && customGrokKey.trim() !== '') ? customGrokKey.trim() : null;

    if (finalGrokKey) {
      const isGroq = finalGrokKey.startsWith('gsk_');
      if (isGroq) {
        clientOptions = {
          apiKey: finalGrokKey,
          baseURL: 'https://api.groq.com/openai/v1'
        };
        modelName = 'llama-3.1-8b-instant';
      } else {
        clientOptions = {
          apiKey: finalGrokKey,
          baseURL: 'https://api.x.ai/v1'
        };
        modelName = 'grok-2';
      }
    } else {
      return { text: "I'm sorry, AI assistant is not configured. Let me connect you with a team member.", handoff: true };
    }

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI(clientOptions);

    let systemPrompt = customPrompt || `You are a helpful WhatsApp business assistant. 
You help customers with their queries professionally and politely.
You can answer questions about products, services, pricing, and general inquiries.

Rules:
- Be concise - WhatsApp messages should be short and readable.
- Use emojis sparingly but naturally.
- If the customer asks to speak to a human, or if you cannot help, respond with exactly "HANDOFF" as the first word.
- Never make up information. If unsure, offer to connect with a team member.
- Be friendly and professional.

Customer name: ${contact.name || 'there'}
Customer phone: ${contact.phone || 'unknown'}`;

    if (customPrompt) {
      systemPrompt = `CRITICAL FORMATTING INSTRUCTION: You must chat with the user to collect their project requirements (scope, budget, timeline). When (and ONLY when) you have collected all these details and are ready to end the chat, you MUST write the word "FINISHED" as the very first word in your response (e.g. "FINISHED Thank you, we have all details!"). If you are still asking questions or if requirements are incomplete, do NOT include the word "FINISHED".\n\n` + systemPrompt;
    }

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

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || '';

    if (reply.toUpperCase().startsWith('HANDOFF')) {
      return { text: '', handoff: true };
    }

    return { text: reply, handoff: false };
  } catch (error) {
    logger.error('AI Agent error:', error.message);
    return { text: "I'm having trouble right now. Let me connect you with our team.", handoff: true };
  }
}

module.exports = { processWithAI };
