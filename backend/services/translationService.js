const axios = require('axios');
const winston = require('winston');
const { resolveAIConfig, callChatCompletions } = require('./aiAgent');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Translate text via AI LLM if available, with Google Translate GTX fallback.
 */
async function translateText({ text, targetLang = 'en', targetLangName = 'English', organizationId = null }) {
  if (!text || !text.trim()) {
    return { translatedText: '', targetLang, targetLangName, provider: 'none' };
  }

  const cleanText = text.trim();

  // 1. Try AI Translation if configured
  try {
    let org = null;
    if (organizationId) {
      const Organization = require('../models/Organization');
      org = await Organization.findById(organizationId);
    }

    const config = resolveAIConfig(org);
    if (config && config.apiKey) {
      const systemPrompt = `You are an expert real-time language translator for WhatsApp customer chat.
Translate the user's message accurately into ${targetLangName} (Language code: "${targetLang}").
Maintain emojis, conversational context, proper names, and natural tone (especially for Indian languages like Hindi, Gujarati, Marathi, etc. and global languages).
Return ONLY the translated text. Do NOT wrap in quotes, do NOT add explanations, do NOT add notes.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: cleanText }
      ];

      const rawAi = await callChatCompletions(config, messages, 0.3, 500);
      let translated = (rawAi || '').trim();
      // Remove any surrounding quotes
      translated = translated.replace(/^["'`]+|["'`]+$/g, '').trim();

      if (translated && translated.length > 0) {
        return {
          translatedText: translated,
          detectedSourceLang: 'auto',
          targetLang,
          targetLangName,
          provider: config.provider || 'ai'
        };
      }
    }
  } catch (aiErr) {
    logger.warn('AI translation attempt failed, switching to Google Translate fallback:', aiErr.message);
  }

  // 2. Google Translate Endpoint (dict-chrome-ex & gtx fallback - Supports all 130+ Google Translate languages)
  const gClients = ['dict-chrome-ex', 'gtx'];
  for (const clientName of gClients) {
    try {
      const encodedText = encodeURIComponent(cleanText);
      const langCode = encodeURIComponent(targetLang);
      const url = `https://translate.googleapis.com/translate_a/single?client=${clientName}&sl=auto&tl=${langCode}&dt=t&q=${encodedText}`;

      const res = await axios.get(url, {
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (Array.isArray(res.data) && Array.isArray(res.data[0])) {
        const combined = res.data[0].map(item => (item && item[0]) ? item[0] : '').join('');
        const detectedSource = res.data[2] || 'auto';

        return {
          translatedText: combined || cleanText,
          detectedSourceLang: detectedSource,
          targetLang,
          targetLangName,
          provider: 'google-translate'
        };
      }
    } catch (gErr) {
      logger.warn(`Google Translate client (${clientName}) failed:`, gErr.message);
    }
  }

  // Fallback: Return original text if both fail
  return {
    translatedText: cleanText,
    detectedSourceLang: 'unknown',
    targetLang,
    targetLangName,
    provider: 'original-fallback'
  };
}

module.exports = {
  translateText
};
