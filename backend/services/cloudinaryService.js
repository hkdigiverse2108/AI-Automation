const cloudinary = require('cloudinary').v2;
const env = require('../config/env');
const winston = require('winston');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
 * @param {string} resourceType - Force resource type (auto, raw, image, video).
 * @returns {Promise<string>} - The secure url of the uploaded file.
 */
function uploadStream(fileBuffer, folder = 'whatsapp_platform', resourceType = 'auto', filename = null) {
  return new Promise((resolve, reject) => {
    if (!isConfigured) {
      return reject(new Error('Cloudinary is not configured.'));
    }

    let determinedResourceType = resourceType;
    let isPdf = false;
    let isZipOrOffice = false;

    if (determinedResourceType === 'auto') {
      const ext = filename ? path.extname(filename).toLowerCase() : '';
      
      if (fileBuffer && fileBuffer.length >= 4) {
        isPdf = fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46;
        isZipOrOffice = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04;
      }
      
      if (ext === '.pdf') isPdf = true;
      if (['.zip', '.rar', '.7z', '.tar', '.gz', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'].includes(ext)) {
        isZipOrOffice = true;
      }

      if (isPdf || isZipOrOffice) {
        determinedResourceType = 'raw';
      }
    }

    const uploadOptions = {
      folder,
      resource_type: determinedResourceType,
    };

    if (determinedResourceType === 'raw') {
      let ext = '';
      if (filename) {
        ext = path.extname(filename).toLowerCase();
      } else {
        if (fileBuffer && fileBuffer.length >= 4) {
          const isPdfFile = fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46;
          const isZipOrOfficeFile = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04;
          if (isPdfFile) ext = '.pdf';
          else if (isZipOrOfficeFile) ext = '.zip';
        }
      }
      uploadOptions.public_id = `${uuidv4()}${ext}`;
    }

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
