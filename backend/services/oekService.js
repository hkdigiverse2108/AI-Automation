const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard GCM IV length is 12 bytes
const AUTH_TAG_LENGTH = 16;

// Local memory caches to avoid redundant database calls
const oekCache = new Map();
const userOekCache = new Map();
const userOrgMap = new Map();

/**
 * Derives a key of exact length from a string using PBKDF2 or scrypt.
 */
function deriveMasterKey() {
  const masterKey = env.ENCRYPTION_KEY;
  if (!masterKey || masterKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }
  return crypto.scryptSync(masterKey, 'oek-salt', 32);
}

/**
 * Generates a high-entropy 256-bit Organization Encryption Key (OEK).
 * Returns hex encoded string (64 characters).
 */
function generateOEK() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypts the Organization Encryption Key (OEK) using the Master Key.
 * Returns iv:tag:ciphertext string.
 */
function encryptOEK(oek) {
  if (!oek) return '';
  const masterKey = deriveMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(oek, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts the OEK using the Master Key.
 * Returns raw OEK hex string.
 */
function decryptOEK(encryptedOek) {
  if (!encryptedOek || !encryptedOek.includes(':')) return null;

  try {
    const masterKey = deriveMasterKey();
    const parts = encryptedOek.split(':');
    if (parts.length !== 3) throw new Error('Invalid OEK format');

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('OEK decryption failed:', err.message);
    return null;
  }
}

/**
 * Encrypts text using the raw OEK (hex string) with AES-256-GCM.
 * Returns iv:tag:ciphertext.
 */
function encryptAES(text, rawOekHex) {
  if (!text) return '';
  try {
    const key = Buffer.from(rawOekHex, 'hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Data encryption error:', err.message);
    return text;
  }
}

/**
 * Decrypts text using the raw OEK (hex string) with AES-256-GCM.
 */
function decryptAES(encryptedText, rawOekHex) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

  try {
    const key = Buffer.from(rawOekHex, 'hex');
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // Return original string if decryption fails (e.g. legacy non-encrypted record)
    return encryptedText;
  }
}

/**
 * Generates a deterministic index hash using HMAC-SHA256 salted with the OEK.
 */
function generateHMAC(text, rawOekHex) {
  if (!text) return '';
  const normalized = text.toString().trim().toLowerCase();
  const key = Buffer.from(rawOekHex, 'hex');
  return crypto.createHmac('sha256', key).update(normalized).digest('hex');
}

/**
 * Fetches and decrypts the OEK for an Organization, with memory caching.
 */
async function getOekForOrg(orgId) {
  if (!orgId) return null;
  const orgIdStr = orgId.toString();

  if (oekCache.has(orgIdStr)) {
    return oekCache.get(orgIdStr);
  }

  const Organization = require('../models/Organization');
  const org = await Organization.findById(orgId);
  if (!org || !org.encryptionConfig?.enabled || !org.encryptionConfig?.oekEncrypted) {
    return null;
  }

  const rawOek = decryptOEK(org.encryptionConfig.oekEncrypted);
  if (rawOek) {
    oekCache.set(orgIdStr, rawOek);
  }
  return rawOek;
}

/**
 * Fetches and decrypts the OEK using owner/agent User ID context.
 */
async function getOekForUser(userId) {
  if (!userId) return null;
  const userIdStr = userId.toString();

  if (userOekCache.has(userIdStr)) {
    return userOekCache.get(userIdStr);
  }

  const User = require('../models/User');
  const user = await User.findById(userId);
  if (!user || !user.organizationId) return null;

  userOrgMap.set(userIdStr, user.organizationId.toString());
  const rawOek = await getOekForOrg(user.organizationId);
  if (rawOek) {
    userOekCache.set(userIdStr, rawOek);
  }
  return rawOek;
}

/**
 * Clears the memory cache for a specific Organization.
 */
function clearOekCache(orgId) {
  if (!orgId) return;
  const orgIdStr = orgId.toString();
  oekCache.delete(orgIdStr);

  // Clear related users from caches
  for (const [uid, oid] of userOrgMap.entries()) {
    if (oid === orgIdStr) {
      userOekCache.delete(uid);
      userOrgMap.delete(uid);
    }
  }
}

/**
 * Encrypts Contact fields before database storage.
 */
function encryptContact(contact, rawOek) {
  if (!rawOek) return contact;
  const encrypted = { ...contact };

  // Calculate deterministic index hashes for search/lookups
  if (contact.phone && !isEncryptedFormat(contact.phone)) {
    encrypted.phoneHash = generateHMAC(contact.phone, rawOek);
    encrypted.phone = encryptAES(contact.phone, rawOek);
  }
  if (contact.email && !isEncryptedFormat(contact.email)) {
    encrypted.emailHash = generateHMAC(contact.email, rawOek);
    encrypted.email = encryptAES(contact.email, rawOek);
  }
  if (contact.name && !isEncryptedFormat(contact.name)) {
    encrypted.nameHash = generateHMAC(contact.name, rawOek);
    encrypted.name = encryptAES(contact.name, rawOek);
  }
  if (contact.notes && !isEncryptedFormat(contact.notes)) {
    encrypted.notes = encryptAES(contact.notes, rawOek);
  }

  // Encrypt customFields map if populated
  if (contact.customFields) {
    const encryptedFields = {};
    const fieldsObj = contact.customFields instanceof Map ? Object.fromEntries(contact.customFields) : contact.customFields;
    for (const [k, v] of Object.entries(fieldsObj)) {
      if (typeof v === 'string' && !isEncryptedFormat(v)) {
        encryptedFields[k] = encryptAES(v, rawOek);
      } else {
        encryptedFields[k] = v;
      }
    }
    encrypted.customFields = encryptedFields;
  }

  encrypted.isEncrypted = true;
  return encrypted;
}

/**
 * Decrypts Contact fields for client delivery.
 */
function decryptContact(contact, rawOek) {
  if (!rawOek || !contact) return contact;
  
  // Create deep copy/object depending on document type
  const doc = contact.toObject ? contact.toObject() : { ...contact };

  if (doc.phone) doc.phone = decryptAES(doc.phone, rawOek);
  if (doc.email) doc.email = decryptAES(doc.email, rawOek);
  if (doc.name) doc.name = decryptAES(doc.name, rawOek);
  if (doc.notes) doc.notes = decryptAES(doc.notes, rawOek);

  if (doc.customFields) {
    const decryptedFields = {};
    const fieldsObj = doc.customFields instanceof Map ? Object.fromEntries(doc.customFields) : doc.customFields;
    for (const [k, v] of Object.entries(fieldsObj)) {
      if (typeof v === 'string') {
        decryptedFields[k] = decryptAES(v, rawOek);
      } else {
        decryptedFields[k] = v;
      }
    }
    doc.customFields = decryptedFields;
  }

  return doc;
}

/**
 * Encrypts Message fields before database storage.
 */
function encryptMessage(message, rawOek) {
  if (!rawOek || !message) return message;
  const encrypted = { ...message };

  if (encrypted.content) {
    encrypted.content = { ...encrypted.content };
    if (encrypted.content.text && !isEncryptedFormat(encrypted.content.text)) {
      encrypted.content.text = encryptAES(encrypted.content.text, rawOek);
    }
    if (encrypted.content.caption && !isEncryptedFormat(encrypted.content.caption)) {
      encrypted.content.caption = encryptAES(encrypted.content.caption, rawOek);
    }
    if (encrypted.content.filename && !isEncryptedFormat(encrypted.content.filename)) {
      encrypted.content.filename = encryptAES(encrypted.content.filename, rawOek);
    }
  }

  encrypted.isEncrypted = true;
  return encrypted;
}

/**
 * Decrypts Message fields for client delivery.
 */
function decryptMessage(message, rawOek) {
  if (!rawOek || !message) return message;
  const doc = message.toObject ? message.toObject() : { ...message };

  if (doc.content) {
    doc.content = { ...doc.content };
    if (doc.content.text) doc.content.text = decryptAES(doc.content.text, rawOek);
    if (doc.content.caption) doc.content.caption = decryptAES(doc.content.caption, rawOek);
    if (doc.content.filename) doc.content.filename = decryptAES(doc.content.filename, rawOek);
  }

  return doc;
}

/**
 * Utility checks if string is in iv:tag:ciphertext hex format.
 */
function isEncryptedFormat(str) {
  if (typeof str !== 'string') return false;
  return /^[a-f0-9]{24,32}:[a-f0-9]{32}:[a-f0-9]+$/i.test(str);
}

module.exports = {
  generateOEK,
  encryptOEK,
  decryptOEK,
  encryptAES,
  decryptAES,
  generateHMAC,
  getOekForOrg,
  getOekForUser,
  clearOekCache,
  encryptContact,
  decryptContact,
  encryptMessage,
  decryptMessage,
  isEncryptedFormat
};
