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
 * Helper to fetch decypted OpenAI credentials for the tenant organization or platform default.
 */
async function getSentimentOpenAIClient(orgId) {
  const { decryptField } = require('./encryption');
  const org = await Organization.findById(orgId);
  
  const customOpenAIKey = org?.aiConfig?.openaiApiKey ? decryptField(org.aiConfig.openaiApiKey) : null;
  const finalOpenAIKey = (customOpenAIKey && customOpenAIKey.trim() !== '') ? customOpenAIKey.trim() : env.OPENAI_API_KEY;

  const hasOpenAI = finalOpenAIKey && finalOpenAIKey !== 'your_openai_api_key' && finalOpenAIKey.trim() !== '';
  if (!hasOpenAI) {
    throw new Error('OpenAI key is not configured for sentiment analysis.');
  }

  const { default: OpenAI } = await import('openai');
  return new OpenAI({ apiKey: finalOpenAIKey });
}

/**
 * Analyze an incoming message in real-time, write to analysis collection, and update the Conversation document.
 */
async function analyzeMessage(conversationId, orgId, messageText) {
  try {
    if (!messageText || messageText.trim() === '') return null;

    const openai = await getSentimentOpenAIClient(orgId);

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
      model: 'gpt-4o-mini', // fast, cheap and perfect for structured analytical categorization
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
