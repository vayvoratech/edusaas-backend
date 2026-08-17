const Redis = require('ioredis');
require('dotenv').config();

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);

  redisClient.on('error', (err) => console.error('Redis Client Error', err.message));
  redisClient.on('connect', () => console.log('[data] connected to Redis'));
} else {
  console.log('[data] REDIS_URL not set. Caching disabled.');
}

module.exports = redisClient;
