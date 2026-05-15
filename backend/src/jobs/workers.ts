import logger from '../utils/logger';
import { config } from '../config';

const redisAvailable = config.redisUrl && !config.redisUrl.includes('localhost');

function startWorkers(): void {
  if (!redisAvailable) {
    logger.info('Workers disabled — no Redis available');
    return;
  }
  try {
    const { Worker } = require('bullmq');
    const connection = { url: config.redisUrl, maxRetriesPerRequest: null, enableReadyCheck: false };

    const emailWorker = new Worker('email', async (job: any) => {
      logger.info(`Processing email job: ${job.name}`, { jobId: job.id });
    }, { connection, concurrency: 5 });

    const smsWorker = new Worker('sms', async (job: any) => {
      logger.info(`Processing SMS job: ${job.name}`, { jobId: job.id });
    }, { connection, concurrency: 10 });

    const socialMediaWorker = new Worker('social-media', async (job: any) => {
      logger.info(`Processing social media job: ${job.name}`, { jobId: job.id, platform: job.data.platform });
    }, { connection, concurrency: 3 });

    const aiMarketingWorker = new Worker('ai-marketing', async (job: any) => {
      logger.info(`Processing AI marketing job: ${job.name}`, { jobId: job.id });
    }, { connection, concurrency: 2 });

    const analyticsWorker = new Worker('analytics', async (job: any) => {
      logger.info(`Processing analytics job: ${job.name}`, { jobId: job.id });
    }, { connection, concurrency: 1 });

    const mpesaWorker = new Worker('mpesa', async (job: any) => {
      logger.info(`Processing M-Pesa job: ${job.name}`, { jobId: job.id });
    }, { connection, concurrency: 2 });

    const cameraWorker = new Worker('camera', async (job: any) => {
      logger.info(`Processing camera job: ${job.name}`, { jobId: job.id });
    }, { connection, concurrency: 2 });

    const cleanupWorker = new Worker('cleanup', async (job: any) => {
      logger.info(`Processing cleanup job: ${job.name}`, { jobId: job.id });
    }, { connection, concurrency: 1 });

    logger.info('All workers started');
  } catch (e: any) {
    logger.warn(`Workers failed to start: ${e.message}`);
  }
}

export { startWorkers };
