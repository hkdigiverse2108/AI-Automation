const cloudinary = require('cloudinary').v2;
const env = require('../config/env');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// Configure Cloudinary if credentials are present
const isConfigured = !!(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  logger.info('Cloudinary Service successfully configured');
} else {
  logger.warn('Cloudinary environment variables missing. Falling back to local storage.');
}

/**
 * Upload a file buffer directly to Cloudinary via stream.
 * @param {Buffer} fileBuffer - File raw buffer.
 * @param {string} folder - Destination folder on Cloudinary.
 * @returns {Promise<string>} - The secure url of the uploaded file.
 */
function uploadStream(fileBuffer, folder = 'whatsapp_platform') {
  return new Promise((resolve, reject) => {
    if (!isConfigured) {
      return reject(new Error('Cloudinary is not configured.'));
    }

    const uploadOptions = {
      folder,
      resource_type: 'auto', // Auto detect image, video, raw document, etc.
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        logger.error('Cloudinary upload stream failed:', error);
        return reject(error);
      }
      resolve(result.secure_url);
    });

    stream.end(fileBuffer);
  });
}

module.exports = {
  isConfigured: () => isConfigured,
  uploadStream,
  cloudinary,
};
