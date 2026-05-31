const mongoose = require('mongoose');
const env = require('./env');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

async function connectDB(retryCount = 0) {
  try {
    const options = {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE, 10) || 100,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    };

    await mongoose.connect(env.MONGODB_URI, options);
    logger.info('MongoDB Atlas connected successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting reconnect...');
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => connectDB(retryCount + 1), RETRY_DELAY);
      }
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return mongoose.connection;
  } catch (error) {
    logger.error(`MongoDB connection attempt ${retryCount + 1} failed: ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying in ${RETRY_DELAY / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return connectDB(retryCount + 1);
    }

    logger.error('Max retries reached. Could not connect to MongoDB.');
    process.exit(1);
  }
}

async function disconnectDB() {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error.message);
  }
}

module.exports = { connectDB, disconnectDB };
