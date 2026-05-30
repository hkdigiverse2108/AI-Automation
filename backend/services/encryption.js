const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const key = env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }
  return crypto.scryptSync(key, 'salt', 32);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: iv:authTag:encryptedData (all hex)
 */
function encryptField(text) {
  if (!text) return text;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted string (iv:authTag:encryptedData format).
 */
function decryptField(encrypted) {
  if (!encrypted || !encrypted.includes(':')) return encrypted;

  try {
    const key = getKey();
    const parts = encrypted.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed. The ENCRYPTION_KEY might be invalid or mismatched:', err.message);
    return null;
  }
}

/**
 * Hash a value with SHA-256 (one-way, for API keys).
 */
function hashSHA256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a random API key with prefix.
 */
function generateApiKey(isTest = false) {
  const prefix = isTest ? 'wap_test_' : 'wap_live_';
  const key = crypto.randomBytes(32).toString('hex');
  return prefix + key;
}

/**
 * Verify Meta webhook signature using timing-safe comparison.
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!signature || !env.META_APP_SECRET) return false;

  const expectedSig =
    'sha256=' +
    crypto.createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.toLowerCase()),
      Buffer.from(expectedSig.toLowerCase())
    );
  } catch {
    return false;
  }
}

module.exports = {
  encryptField,
  decryptField,
  hashSHA256,
  generateApiKey,
  verifyWebhookSignature,
};
