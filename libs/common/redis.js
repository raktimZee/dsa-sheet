import Redis from 'ioredis';
import { logger } from './logger.js';

// Factory for an ioredis client. Used for caching (content), distributed rate-limiting
// (gateway), and as the BullMQ backend (progress -> notification).
export function makeRedis(url, svc = 'redis') {
  const log = logger(svc);
  const client = new Redis(url, {
    maxRetriesPerRequest: null, // required by BullMQ; harmless elsewhere
    enableReadyCheck: true,
  });
  client.on('error', (e) => log.warn('redis error', { err: e.message }));
  client.on('connect', () => log.info('redis connected'));
  return client;
}
