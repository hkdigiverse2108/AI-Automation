const ConversationAiAnalysis = require('../models/ConversationAiAnalysis');
const Conversation = require('../models/Conversation');
const Organization = require('../models/Organization');
const env = require('../config/env');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Helper to fetch decrypted Grok credentials for the tenant organization.
 */
async function getSentimentAIClient(orgId) {
  const { decryptField } = require('./encryption');
  const org = await Organization.findById(orgId);
  
  const customGrokKey = org?.aiConfig?.grokApiKey ? decryptField(org.aiConfig.grokApiKey) : null;
  const finalGrokKey = (customGrokKey && customGrokKey.trim() !== '') ? customGrokKey.trim() : null;

  if (!finalGrokKey) {
    throw new Error('Grok API Key is not configured for sentiment analysis.');
  }

  let clientOptions = {};
  let modelName = 'grok-2';

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

  const { default: OpenAI } = await import('openai');
  return { openai: new OpenAI(clientOptions), modelName };
}

/**
 * Analyze an incoming message in real-time, write to analysis collection, and update the Conversation document.
 */
async function analyzeMessage(conversationId, orgId, messageText) {
  try {
    if (!messageText || messageText.trim() === '') return null;

    const { openai, modelName } = await getSentimentAIClient(orgId);

    const systemPrompt = `You are a real-time customer behavior analyst.
Read the user's incoming message and return an accurate behavioral and sentiment analysis.
Format your output as a strictly valid JSON object with the following fields:
{
  "sentiment": "positive" | "neutral" | "frustrated" | "angry",
  "urgency": "low" | "medium" | "high" | "critical",
  "risk": "normal" | "escalation" | "churn",
  "isComplaint": true | false,
  "isRefundRequested": true | false,
  "isLegalThreat": true | false,
  "isVipCustomer": true | false,
  "confidence": float (between 0.0 and 1.0),
  "aiReasoning": "1 sentence summarizing the sentiment trigger"
}

Critical Triggers:
- Urgent: Requests immediate action, time-sensitive queries.
- Critical: Outrage, legal threats, persistent product crashes, severe abuse.
- Refund request: Mentioning "refund", "return money", "cancel plan".
- Legal threat: Mentioning "sue", "lawyer", "consumer court", "legal action".
- VIP: Mentioning high-value account, VIP, premium status.

Return ONLY the raw JSON string with no markdown blocks or conversational text.`;

    const completion = await openai.chat.completions.create({
      model: modelName, // fast, cheap and perfect for structured analytical categorization
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: messageText }
      ],
      max_tokens: 300,
      temperature: 0.2, // highly deterministic
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let analysis;
    try {
      analysis = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch {
      logger.warn('Failed to parse sentiment AI JSON. Retrying with basic regex lookup...');
      // Fallback categorization if parser fails
      const lower = messageText.toLowerCase();
      analysis = {
        sentiment: lower.includes('angry') || lower.includes('bad') ? 'angry' : 'neutral',
        urgency: lower.includes('urgent') || lower.includes('asap') ? 'high' : 'low',
        risk: 'normal',
        isComplaint: false,
        isRefundRequested: lower.includes('refund') || lower.includes('cancel'),
        isLegalThreat: lower.includes('sue') || lower.includes('lawyer'),
        isVipCustomer: false,
        confidence: 0.5,
        aiReasoning: 'Regex fallback activated.'
      };
    }

    // Save history
    const createdAnalysis = await ConversationAiAnalysis.create({
      conversationId,
      orgId,
      sentiment: analysis.sentiment,
      urgency: analysis.urgency,
      risk: analysis.risk,
      confidence: analysis.confidence || 0.9,
      aiReasoning: analysis.aiReasoning || '',
      isComplaint: !!analysis.isComplaint,
      isRefundRequested: !!analysis.isRefundRequested,
      isLegalThreat: !!analysis.isLegalThreat,
      isVipCustomer: !!analysis.isVipCustomer
    });

    // Update main Conversation fields
    await Conversation.findByIdAndUpdate(conversationId, {
      sentiment: analysis.sentiment,
      urgency: analysis.urgency,
      risk: analysis.risk,
      aiConfidence: analysis.confidence || 0.9,
      isComplaint: !!analysis.isComplaint,
      isRefundRequested: !!analysis.isRefundRequested,
      isLegalThreat: !!analysis.isLegalThreat,
      isVipCustomer: !!analysis.isVipCustomer
    });

    logger.info(`Message analyzed: ${analysis.sentiment} | Urgency: ${analysis.urgency}`);
    return createdAnalysis;
  } catch (err) {
    logger.error('Sentiment Engine error:', err.message);
    return null;
  }
}

module.exports = { analyzeMessage };
