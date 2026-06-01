const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const META_API_URL = 'https://graph.facebook.com/v18.0';
const MAX_RETRIES = 3;

async function metaApiCall(method, url, data, token, retries = 0) {
  // Sanitize recipient phone number if present
  if (data && typeof data === 'object' && data.to) {
    data.to = String(data.to).replace(/\D/g, '');
  }

  // Mock Sandbox Mode for demo/mock tokens
  if (token === 'demo' || token === 'mock' || token?.startsWith('mock_')) {
    logger.info(`[MOCK SANDBOX] Intercepted ${method.toUpperCase()} ${url}`);
    
    // Mock template syncing
    if (url.endsWith('/message_templates') && method.toLowerCase() === 'get') {
      return {
        success: true,
        data: {
          data: [
            {
              id: "tpl_12345",
              name: "WELCOME_PROMO_BLAST",
              category: "MARKETING",
              language: "en",
              status: "APPROVED",
              components: [
                { type: "HEADER", text: "Exclusive Discount!" },
                { type: "BODY", text: "Hello {{1}}, thank you for subscribing! 🎉 Enjoy an exclusive {{2}}% discount on your next order. Use code {{3}} at checkout." },
                { type: "FOOTER", text: "Reply STOP to unsubscribe." },
                { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Claim Offer" }] }
              ]
            },
            {
              id: "tpl_67890",
              name: "ORDER_SHIPMENT_UPDATE",
              category: "UTILITY",
              language: "en",
              status: "APPROVED",
              components: [
                { type: "HEADER", text: "Shipment Confirmed" },
                { type: "BODY", text: "Hi {{1}}, order #{{2}} is on its way! Track: {{3}}" }
              ]
            },
            {
              id: "tpl_99988",
              name: "IMAGE_PROMO_BLAST",
              category: "MARKETING",
              language: "en",
              status: "APPROVED",
              components: [
                { type: "HEADER", format: "IMAGE" },
                { type: "BODY", text: "Hello {{1}}, thank you for subscribing! 🎉 Enjoy an exclusive {{2}}% discount on your next order." },
                { type: "FOOTER", text: "Reply STOP to unsubscribe." },
                { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Claim Offer" }] }
              ]
            }
          ]
        }
      };
    }

    // Mock template creation
    if (url.endsWith('/message_templates') && method.toLowerCase() === 'post') {
      return {
        success: true,
        data: { id: "tpl_" + Math.floor(Math.random() * 1000000) }
      };
    }

    // Mock message sending
    if (url.endsWith('/messages') && method.toLowerCase() === 'post') {
      return {
        success: true,
        data: {
          messages: [{ id: "msg_" + Math.floor(Math.random() * 1000000000) }]
        }
      };
    }

    // Catch-all mock response
    return { success: true, data: { id: "mock_id_" + Math.floor(Math.random() * 100000) } };
  }

  try {
    const config = {
      method,
      url,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    if (data) config.data = data;
    const response = await axios(config);
    logger.info(`Meta API ${method.toUpperCase()} ${url} — OK`);
    return { success: true, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const errData = error.response?.data?.error || {};

    if (status === 429 && retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000;
      logger.warn(`Meta API rate limited, retrying in ${delay}ms (attempt ${retries + 1})`);
      await new Promise((r) => setTimeout(r, delay));
      return metaApiCall(method, url, data, token, retries + 1);
    }

    logger.error(`Meta API error: ${errData.message || error.message}`, { code: errData.code, status });
    return { success: false, error: errData.message || error.message, code: errData.code };
  }
}

async function sendTextMessage(phoneNumberId, token, to, text) {
  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  }, token);
}

const urlCache = new Map();

async function proxyImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http') || imageUrl.includes('res.cloudinary.com')) {
    return imageUrl;
  }

  // Check in-memory cache first
  if (urlCache.has(imageUrl)) {
    return urlCache.get(imageUrl);
  }

  const cacheKey = `cloudinary_proxy:${imageUrl}`;
  try {
    const { getRedisClient } = require('../config/redis');
    const redis = getRedisClient();
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        urlCache.set(imageUrl, cached);
        return cached;
      }
    }
  } catch (err) {
    logger.error('Failed to query Redis for image proxy cache:', err.message);
  }

  try {
    const cloudinaryService = require('./cloudinaryService');
    if (!cloudinaryService.isConfigured()) {
      logger.warn('Cloudinary is not configured, sending original image URL.');
      return imageUrl;
    }

    logger.info(`Downloading remote image to proxy through Cloudinary: ${imageUrl}`);
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    const cloudinaryUrl = await cloudinaryService.uploadStream(buffer, 'whatsapp_image_proxy');
    logger.info(`Successfully proxied image via Cloudinary: ${cloudinaryUrl}`);

    // Cache the result
    urlCache.set(imageUrl, cloudinaryUrl);
    try {
      const { getRedisClient } = require('../config/redis');
      const redis = getRedisClient();
      if (redis) {
        await redis.set(cacheKey, cloudinaryUrl);
      }
    } catch (err) {
      logger.error('Failed to save to Redis for image proxy cache:', err.message);
    }

    return cloudinaryUrl;
  } catch (error) {
    logger.error(`Error proxying image URL ${imageUrl} through Cloudinary:`, error.message);
    return imageUrl; // Fallback to original URL
  }
}

async function sendImageMessage(phoneNumberId, token, to, imageUrl, caption = '', mediaId = null) {
  let finalImageUrl = imageUrl;
  if (!mediaId) {
    finalImageUrl = await proxyImageUrl(imageUrl);
  }
  const imagePayload = mediaId ? { id: mediaId, caption } : { link: finalImageUrl, caption };
  const res = await metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: imagePayload,
  }, token);

  res.sentUrl = finalImageUrl;
  return res;
}

async function sendDocumentMessage(phoneNumberId, token, to, docUrl, filename = 'document', mediaId = null) {
  const docPayload = mediaId ? { id: mediaId, filename } : { link: docUrl, filename };
  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: docPayload,
  }, token);
}

async function sendVideoMessage(phoneNumberId, token, to, videoUrl, caption = '', mediaId = null) {
  const videoPayload = mediaId ? { id: mediaId, caption } : { link: videoUrl, caption };
  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'video',
    video: videoPayload,
  }, token);
}

async function sendAudioMessage(phoneNumberId, token, to, audioUrl, mediaId = null) {
  const audioPayload = mediaId ? { id: mediaId } : { link: audioUrl };
  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'audio',
    audio: audioPayload,
  }, token);
}


async function sendButtonMessage(phoneNumberId, token, to, bodyText, buttons) {
  const actionButtons = buttons.slice(0, 3).map((btn, i) => ({
    type: 'reply',
    reply: { id: btn.id || `btn_${i}`, title: btn.title.slice(0, 20) },
  }));

  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: actionButtons },
    },
  }, token);
}

async function sendListMessage(phoneNumberId, token, to, bodyText, sections, header = '', footer = '') {
  const interactive = {
    type: 'list',
    body: { text: bodyText },
    action: { button: 'Choose', sections },
  };
  if (header) interactive.header = { type: 'text', text: header };
  if (footer) interactive.footer = { text: footer };

  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive,
  }, token);
}

async function sendTemplateMessage(phoneNumberId, token, to, templateName, languageCode = 'en', components = []) {
  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  }, token);
}

async function sendReactionMessage(phoneNumberId, token, to, messageId, emoji) {
  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'reaction',
    reaction: { message_id: messageId, emoji },
  }, token);
}

async function markAsRead(phoneNumberId, token, messageId) {
  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  }, token);
}

async function uploadMedia(phoneNumberId, token, fileBuffer, mimeType) {
  if (token === 'demo' || token === 'mock' || token?.startsWith('mock_')) {
    logger.info(`[MOCK SANDBOX] Intercepted media upload`);
    return { success: true, data: { id: "mock_media_id_" + Math.floor(Math.random() * 10000000) } };
  }
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', fileBuffer, { contentType: mimeType, filename: 'upload' });
    form.append('type', mimeType);

    const response = await axios.post(`${META_API_URL}/${phoneNumberId}/media`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Upload media error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

async function getMediaUrl(mediaId, token) {
  return metaApiCall('get', `${META_API_URL}/${mediaId}`, null, token);
}

async function downloadMedia(mediaId, token, destPath) {
  if (token === 'demo' || token === 'mock' || token?.startsWith('mock_')) {
    logger.info(`[MOCK SANDBOX] Intercepted downloadMedia for ID ${mediaId}`);
    return { success: true };
  }
  try {
    const metaRes = await getMediaUrl(mediaId, token);
    if (!metaRes.success || !metaRes.data?.url) {
      throw new Error(metaRes.error || 'Failed to resolve media URL from Meta');
    }
    
    const mediaUrl = metaRes.data.url;
    
    const response = await axios({
      method: 'get',
      url: mediaUrl,
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'stream'
    });

    const fs = require('fs');
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return { success: true };
  } catch (error) {
    logger.error(`Download media binary error for ID ${mediaId}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function getTemplates(wabaId, token) {
  return metaApiCall('get', `${META_API_URL}/${wabaId}/message_templates`, null, token);
}

async function createTemplate(wabaId, token, templateData) {
  return metaApiCall('post', `${META_API_URL}/${wabaId}/message_templates`, templateData, token);
}

async function sendContactMessage(phoneNumberId, token, to, name, phone) {
  if (token === 'demo' || token === 'mock' || token?.startsWith('mock_')) {
    logger.info(`[MOCK SANDBOX] Intercepted sendContactMessage to ${to}`);
    return {
      success: true,
      data: {
        messages: [{ id: "msg_" + Math.floor(Math.random() * 1000000000) }]
      }
    };
  }

  return metaApiCall('post', `${META_API_URL}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'contacts',
    contacts: [
      {
        name: {
          formatted_name: name,
          first_name: name.split(' ')[0] || '',
          last_name: name.split(' ').slice(1).join(' ') || ''
        },
        phones: [
          {
            phone: phone,
            type: 'MOBILE'
          }
        ]
      }
    ]
  }, token);
}

module.exports = {
  sendTextMessage,
  sendImageMessage,
  sendDocumentMessage,
  sendVideoMessage,
  sendAudioMessage,
  sendButtonMessage,
  sendListMessage,
  sendTemplateMessage,
  sendReactionMessage,
  markAsRead,
  uploadMedia,
  getMediaUrl,
  downloadMedia,
  getTemplates,
  createTemplate,
  sendContactMessage,
};
