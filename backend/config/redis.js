const Redis = require('ioredis');
const env = require('./env');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    logger.info('Initializing shared Redis client...');
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client connection error:', err.message);
    });
  }
  return redisClient;
}

module.exports = { getRedisClient };
