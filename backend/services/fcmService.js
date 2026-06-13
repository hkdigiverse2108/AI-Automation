const admin = require('firebase-admin');
const DeviceToken = require('../models/DeviceToken');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

let isInitialized = false;

function initFirebase() {
  if (isInitialized) return true;

  try {
    // 1. Try environment path variable first
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      isInitialized = true;
      logger.info('Firebase Admin successfully initialized from environment path');
      return true;
    }

    // 2. Try default local fallback file path in config or root
    const localPath = path.join(__dirname, '..', 'firebase-service-account.json');
    if (fs.existsSync(localPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      isInitialized = true;
      logger.info('Firebase Admin successfully initialized from local fallback file');
      return true;
    }

    logger.warn('Firebase Admin NOT initialized: No service account credential file found. Push notifications will be disabled.');
    return false;
  } catch (err) {
    logger.error('Failed to initialize Firebase Admin:', err.message);
    return false;
  }
}

// Initialize on startup
initFirebase();

/**
 * Send push notification to all device tokens of a user
 * @param {string} userId - Target user ID
 * @param {string} title - Title of notification
 * @param {string} body - Body content of notification
 * @param {Object} payload - Optional data payload
 */
async function sendPushNotification(userId, title, body, payload = {}) {
  const initialized = initFirebase();
  if (!initialized) return;

  try {
    const tokensDoc = await DeviceToken.find({ userId }).select('token').lean();
    const tokens = tokensDoc.map(t => t.token).filter(t => t);

    if (tokens.length === 0) {
      logger.debug(`No device tokens registered for user: ${userId}`);
      return;
    }

    // Prepare message structure
    // Stringify payload values because FCM data field requires string values
    const stringPayload = {};
    for (const key of Object.keys(payload)) {
      if (payload[key] !== undefined && payload[key] !== null) {
        stringPayload[key] = typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : String(payload[key]);
      }
    }

    const message = {
      notification: { title, body },
      data: stringPayload,
    };

    logger.info(`Sending push notification to ${tokens.length} devices for user ${userId}`);

    // Use sendEachForMulticast in firebase-admin v11+
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: message.notification,
      data: message.data,
    });

    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          // Clean up expired / invalid tokens
          if (resp.error?.code === 'messaging/invalid-registration-token' || 
              resp.error?.code === 'messaging/registration-token-not-registered') {
            DeviceToken.deleteOne({ token: tokens[idx] }).catch(err => 
              logger.error('Failed to delete stale device token:', err.message)
            );
          }
        }
      });
      logger.info(`FCM status: ${response.successCount} succeeded, ${response.failureCount} failed.`);
    } else {
      logger.debug(`All ${tokens.length} push notifications delivered successfully.`);
    }
  } catch (err) {
    logger.error('FCM sendPushNotification error:', err.message);
  }
}

module.exports = {
  sendPushNotification
};
