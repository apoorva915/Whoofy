import { Worker, Job } from 'bullmq';
import { QueueName, ViewTrackingJobData } from './queue';
import env from '@/config/env';
import prisma from '@/config/database';
import logger from '@/utils/logger';
import { runViewTrackingSnapshot } from '@/services/view-tracking/run-snapshot';

/**
 * View tracking worker
 * Processes jobs to fetch view counts and detect spikes (uses shared run-snapshot service).
 */
export function createViewTrackingWorker(): Worker {
  const worker = new Worker<ViewTrackingJobData>(
    QueueName.VIEW_TRACKING,
    async (job: Job<ViewTrackingJobData>) => {
      const { reelSubmissionId, reelUrl, campaignId } = job.data;

      if (!reelUrl?.trim()) {
        logger.error({ reelSubmissionId }, 'View tracking job has no reelUrl');
        throw new Error('Job data missing reelUrl');
      }

      logger.info(`Processing view tracking job for submission ${reelSubmissionId}`);

      const result = await runViewTrackingSnapshot({
        reelSubmissionId,
        reelUrl,
        campaignId,
      });

      if (!result.success) {
        const msg = result.error || 'Unknown error';
        if (msg.includes('Apify') || msg.includes('API') || msg.includes('scraper')) {
          throw new Error(msg);
        }
        return result;
      }

      return result;
    },
    {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per minute (to respect API rate limits)
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`View tracking job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    logger.error(
      { error, jobId: job?.id, data: job?.data },
      `View tracking job ${job?.id} failed`
    );
  });

  worker.on('error', (error) => {
    logger.error({ error }, 'View tracking worker error');
  });

  logger.info('View tracking worker started');

  return worker;
}

// Export singleton worker instance
let viewTrackingWorker: Worker | null = null;

export function getViewTrackingWorker(): Worker {
  if (!viewTrackingWorker) {
    viewTrackingWorker = createViewTrackingWorker();
  }
  return viewTrackingWorker;
}

/**
 * Function to detect sudden view spikes
 */
export async function detectViewSpikes(reelSubmissionId: string, intervalHours: number) {
  try {
    // Fetch the last two snapshots for the given reel submission
    const snapshots = await prisma.view_tracking_snapshots.findMany({
      where: { reelSubmissionId },
      orderBy: { snapshotAt: 'desc' },
      take: 2,
    });

    if (snapshots.length < 2) {
      logger.info(`Not enough snapshots to detect spikes for submission ${reelSubmissionId}`);
      return;
    }

    const [latestSnapshot, previousSnapshot] = snapshots;

    // Calculate the view increase percentage
    const viewIncrease = latestSnapshot.viewCount - previousSnapshot.viewCount;
    const timeDiffHours = (new Date(latestSnapshot.snapshotAt).getTime() - new Date(previousSnapshot.snapshotAt).getTime()) / (1000 * 60 * 60);
    const viewIncreasePercentage = (viewIncrease / previousSnapshot.viewCount) * 100;

    // Define a threshold for a view spike (e.g., 50% increase in views within the interval)
    const spikeThreshold = 50; // 50% increase

    if (viewIncreasePercentage > spikeThreshold) {
      // Mark the latest snapshot as a spike
      await prisma.view_tracking_snapshots.update({
        where: { id: latestSnapshot.id },
        data: {
          isSpikeDetected: true,
          spikeReason: `View spike detected: ${viewIncreasePercentage.toFixed(2)}% increase in ${timeDiffHours.toFixed(2)} hours`,
        },
      });

      logger.info(`View spike detected for submission ${reelSubmissionId}: ${viewIncreasePercentage.toFixed(2)}% increase`);
    }
  } catch (error) {
    logger.error({ error }, `Error detecting view spikes for submission ${reelSubmissionId}`);
  }
}

/**
 * Function to calculate and analyze engagement ratio
 */
export async function analyzeEngagementRatio(reelSubmissionId: string) {
  try {
    // Fetch the latest snapshot for the given reel submission
    const latestSnapshot = await prisma.view_tracking_snapshots.findFirst({
      where: { reelSubmissionId },
      orderBy: { snapshotAt: 'desc' },
    });

    if (!latestSnapshot || latestSnapshot.viewCount === 0) {
      logger.info(`No valid snapshot or views for engagement analysis on submission ${reelSubmissionId}`);
      return;
    }

    // Calculate engagement ratio (treat nullable counts as 0)
    const engagementRatio =
      ((latestSnapshot.likeCount ?? 0) +
        (latestSnapshot.commentCount ?? 0) +
        (latestSnapshot.shareCount ?? 0) +
        ((latestSnapshot as any).saveCount ?? 0)) /
      latestSnapshot.viewCount;

    // Determine engagement label based on thresholds
    let engagementLabel = 'Unknown';
    if (engagementRatio < 0.005) {
      engagementLabel = 'Suspicious';
    } else if (engagementRatio >= 0.01 && engagementRatio <= 0.03) {
      engagementLabel = 'Average';
    } else if (engagementRatio >= 0.04) {
      engagementLabel = 'Strong or Organic';
    }

    // Update the snapshot with the engagement ratio and label
    await prisma.view_tracking_snapshots.update({
      where: { id: latestSnapshot.id },
      data: {
        engagementRatio,
        engagementLabel,
      },
    });

    logger.info(`Engagement ratio analyzed for submission ${reelSubmissionId}: ${engagementRatio.toFixed(4)} (${engagementLabel})`);
  } catch (error) {
    logger.error({ error }, `Error analyzing engagement ratio for submission ${reelSubmissionId}`);
  }
}
