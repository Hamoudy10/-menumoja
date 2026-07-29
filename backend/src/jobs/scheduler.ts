import logger from '../utils/logger';
import { config } from '../config';

const redisAvailable = config.redisUrl && !config.redisUrl.includes('localhost');

function startScheduler(): void {
  if (!redisAvailable) {
    logger.info('Job scheduler disabled — no Redis available');
    return;
  }
  try {
    const { Queue } = require('bullmq');
    const connection = { url: config.redisUrl, maxRetriesPerRequest: null, enableReadyCheck: false };

    const queues = [
      new Queue('email', { connection }),
      new Queue('sms', { connection }),
      new Queue('social-media', { connection }),
      new Queue('analytics', { connection }),
      new Queue('mpesa', { connection }),
      new Queue('camera', { connection }),
      new Queue('cleanup', { connection }),
    ];

    logger.info('Job schedulers initialized');
  } catch (e: any) {
    logger.warn(`Job scheduler failed to start: ${e.message}`);
  }
}

export { startScheduler as initializeScheduler };
