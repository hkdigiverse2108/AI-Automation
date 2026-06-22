const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ensure backend/public/audio-cache directory exists
const cacheDir = path.resolve(__dirname, '../public/audio-cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

/**
 * Generate MD5 hash representing text, language, and voice ID
 */
function getHash(text, lang, voiceId) {
  const normalizedText = (text || '').trim().toLowerCase();
  return crypto.createHash('md5').update(`${normalizedText}_${lang}_${voiceId}`).digest('hex');
}

/**
 * ElevenLabs Multilingual TTS Service
 * @param {string} text - Text to convert to speech
 * @param {string} lang - Language code ('en', 'hi', 'gu')
 * @param {string} voiceIdOverride - Optional voice ID override
 * @returns {Promise<string>} Public URL of the cached MP3 file (e.g. '/public/audio-cache/xyz.mp3')
 */
async function getTTSAudioUrl(text, lang = 'en', voiceIdOverride = '') {
  // Use ElevenLabs default voice if none provided (e.g., Rachel voice ID)
  const voiceId = voiceIdOverride || process.env.ELEVENLABS_DEFAULT_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!text || !text.trim()) {
    throw new Error('Text is required for TTS generation');
  }

  const hash = getHash(text, lang, voiceId);
  const filename = `${hash}.mp3`;
  const filePath = path.join(cacheDir, filename);
  const publicUrl = `/public/audio-cache/${filename}`;

  // 1. Check if file is already cached
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) {
    console.log(`[TTS Cache Hit] Found cached audio file: ${filename}`);
    return publicUrl;
  }

  // 2. Fallback in development if API key is missing
  if (!apiKey) {
    console.warn(`[TTS Warning] ELEVENLABS_API_KEY is not configured. Creating a mock silent file for dev: ${filename}`);
    // Write a tiny empty/silent mp3 file so application execution does not fail
    const dummyBuffer = Buffer.alloc(1000);
    fs.writeFileSync(filePath, dummyBuffer);
    return publicUrl;
  }

  console.log(`[TTS Cache Miss] Requesting ElevenLabs generation for text length: ${text.length}, language: ${lang}`);
  
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  let attempts = 0;
  const maxRetries = 3;
  let delay = 1000;

  while (attempts < maxRetries) {
    try {
      const response = await axios({
        method: 'POST',
        url,
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'accept': 'audio/mpeg'
        },
        data: {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        },
        responseType: 'stream',
        timeout: 15000 // 15 seconds timeout
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`[TTS Success] Saved audio file to cache: ${filename}`);
      return publicUrl;
    } catch (error) {
      attempts++;
      console.error(`[TTS Error] Attempt ${attempts}/${maxRetries} failed: ${error.message}`);
      
      // If we ran out of retries, write a mock file so the IVR or script flow doesn't break entirely,
      // but log a severe warning.
      if (attempts >= maxRetries) {
        console.error(`[TTS Fatal] ElevenLabs TTS generation failed after ${maxRetries} attempts. Falling back to dummy file.`);
        const dummyBuffer = Buffer.alloc(1000);
        fs.writeFileSync(filePath, dummyBuffer);
        return publicUrl;
      }

      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

module.exports = {
  getTTSAudioUrl
};
