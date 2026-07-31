import logger from '../utils/logger';
import { config } from '../config';

const redisAvailable = config.redisUrl && !config.redisUrl.includes('localhost');

interface QueueLike {
  add(name: string, data: any, opts?: any): Promise<any>;
  getJob(name: string): Promise<any | null>;
  getJobs(types?: string[]): Promise<any[]>;
  getActiveCount(): Promise<number>;
  getWaitingCount(): Promise<number>;
  close(): Promise<void>;
  name: string;
}

function createNullQueue(name: string): QueueLike {
  return {
    name,
    add: async () => {},
    getJob: async () => null,
    getJobs: async () => [],
    getActiveCount: async () => 0,
    getWaitingCount: async () => 0,
    close: async () => {},
  };
}

const connection: any = redisAvailable ? {
  url: config.redisUrl,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
} : null;

const defaultJobOptions: any = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600 * 24, count: 100 },
  removeOnFail: { age: 3600 * 24 * 7, count: 500 },
};

function createQueue(name: string): QueueLike {
  if (!redisAvailable || !connection) {
    logger.info(`Queue "${name}" disabled — no Redis`);
    return createNullQueue(name);
  }
  try {
    const { Queue } = require('bullmq');
    return new Queue(name, { connection, defaultJobOptions });
  } catch (e: any) {
    logger.warn(`Queue "${name}" unavailable: ${e.message}`);
    return createNullQueue(name);
  }
}

export const emailQueue = createQueue('email');
export const smsQueue = createQueue('sms');
export const socialMediaQueue = createQueue('social-media');
export const analyticsQueue = createQueue('analytics');
export const mpesaQueue = createQueue('mpesa');
export const cameraQueue = createQueue('camera');
export const cleanupQueue = createQueue('cleanup');

async function addEmailJob(name: string, data: Record<string, unknown>, delay?: number): Promise<string | undefined> {
  try { return (await emailQueue.add(name, data, { delay, attempts: 3 }))?.id; } catch { return undefined; }
}
async function addSmsJob(name: string, data: Record<string, unknown>, delay?: number): Promise<string | undefined> {
  try { return (await smsQueue.add(name, data, { delay, attempts: 3 }))?.id; } catch { return undefined; }
}
async function addSocialMediaJob(name: string, data: Record<string, unknown>, delay?: number): Promise<string | undefined> {
  try { return (await socialMediaQueue.add(name, data, { delay, attempts: 3 }))?.id; } catch { return undefined; }
}
async function addAnalyticsJob(name: string, data: Record<string, unknown>, delay?: number): Promise<string | undefined> {
  try { return (await analyticsQueue.add(name, data, { delay }))?.id; } catch { return undefined; }
}
async function addMpesaJob(name: string, data: Record<string, unknown>, delay?: number): Promise<string | undefined> {
  try { return (await mpesaQueue.add(name, data, { delay }))?.id; } catch { return undefined; }
}
async function addCameraJob(name: string, data: Record<string, unknown>, delay?: number): Promise<string | undefined> {
  try { return (await cameraQueue.add(name, data, { delay }))?.id; } catch { return undefined; }
}
async function addCleanupJob(name: string, data: Record<string, unknown>, delay?: number): Promise<string | undefined> {
  try { return (await cleanupQueue.add(name, data, { delay }))?.id; } catch { return undefined; }
}

function formatJobData<T>(data: T): T { return data; }

function getQueue(name: string): QueueLike | undefined {
  const queues: Record<string, QueueLike> = {
    email: emailQueue, sms: smsQueue, 'social-media': socialMediaQueue,
    analytics: analyticsQueue,
    mpesa: mpesaQueue, camera: cameraQueue, cleanup: cleanupQueue,
  };
  return queues[name];
}

async function pauseAllQueues(): Promise<void> {
  logger.info('Queues disabled — no Redis available');
}
async function resumeAllQueues(): Promise<void> { }

export {
  addEmailJob, addSmsJob, addSocialMediaJob,
  addAnalyticsJob, addMpesaJob, addCameraJob, addCleanupJob,
  formatJobData, getQueue, pauseAllQueues, resumeAllQueues,
};
