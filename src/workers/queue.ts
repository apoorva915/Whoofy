import { Queue, QueueOptions } from 'bullmq';
import env from '@/config/env';
import logger from '@/utils/logger';

/**
 * Queue names
 */
export enum QueueName {
  VIEW_TRACKING = 'view-tracking',
}

/**
 * View tracking job data
 */
export interface ViewTrackingJobData {
  reelSubmissionId: string;
  reelUrl: string;
  campaignId: string;
}

/**
 * Queue options
 */
const queueOptions: QueueOptions = {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

/**
 * View tracking queue (lazy initialization)
 */
let _viewTrackingQueue: Queue<ViewTrackingJobData> | null = null;

export function getViewTrackingQueue(): Queue<ViewTrackingJobData> {
  if (!_viewTrackingQueue) {
    try {
      _viewTrackingQueue = new Queue<ViewTrackingJobData>(
        QueueName.VIEW_TRACKING,
        queueOptions
      );
      logger.info('View tracking queue initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize view tracking queue');
      throw error;
    }
  }
  return _viewTrackingQueue;
}

// Note: Use getViewTrackingQueue() directly instead of exporting the queue object
// This ensures proper lazy initialization and error handling

/**
 * Add a view tracking job for a reel submission
 */
export async function addViewTrackingJob(
  data: ViewTrackingJobData,
  options?: {
    repeat?: {
      every: number; // milliseconds
      immediately?: boolean;
    };
  }
): Promise<void> {
  try {
    const queue = getViewTrackingQueue();
    if (options?.repeat) {
      // Recurring job - fetch views at regular intervals
      await queue.add(
        `track-views-${data.reelSubmissionId}`,
        data,
        {
          repeat: {
            every: options.repeat.every,
            immediately: options.repeat.immediately ?? false,
          },
          jobId: `view-tracking-${data.reelSubmissionId}`, // Unique ID to prevent duplicates
        }
      );
      logger.info(
        `Added recurring view tracking job for submission ${data.reelSubmissionId} (every ${options.repeat.every}ms)`
      );
    } else {
      // One-time job
      await queue.add('track-views', data);
      logger.info(`Added view tracking job for submission ${data.reelSubmissionId}`);
    }
  } catch (error) {
    logger.error({ error }, 'Error adding view tracking job');
    throw error;
  }
}

/**
 * Remove a recurring view tracking job by finding repeatable jobs for this submission and removing by key.
 */
export async function removeViewTrackingJob(reelSubmissionId: string): Promise<void> {
  try {
    const queue = getViewTrackingQueue();
    const jobName = `track-views-${reelSubmissionId}`;
    const repeatableJobs = await queue.getRepeatableJobs();
    const toRemove = repeatableJobs.filter(
      (j) => j.name === jobName || j.id?.startsWith(jobName) || String(j.id).includes(reelSubmissionId)
    );
    for (const job of toRemove) {
      if (job.key) {
        await queue.removeRepeatableByKey(job.key);
        logger.info(`Removed repeatable job ${job.key} for submission ${reelSubmissionId}`);
      }
    }
    if (toRemove.length === 0) {
      logger.info(`No repeatable view tracking job found for submission ${reelSubmissionId}`);
    }
  } catch (error) {
    logger.error({ error }, 'Error removing view tracking job');
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  try {
    const queue = getViewTrackingQueue();
    
    // Get queue stats - BullMQ v5 API
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    
    // Check if queue is paused (not a count, but a boolean)
    const isPaused = await queue.isPaused().catch(() => false);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused ? 1 : 0, // Convert boolean to number for consistency
    };
  } catch (error) {
    logger.error({ error }, 'Error getting queue stats');
    throw error;
  }
}
