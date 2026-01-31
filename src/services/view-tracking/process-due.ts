/**
 * Process due view-tracking jobs (DB-driven scheduling).
 * Finds ACTIVE jobs where next_run_at <= now, runs one snapshot per job, then sets next_run_at += interval_hours.
 * Call this every minute from a cron or standalone scheduler so tracking continues without the dev server or BullMQ worker.
 */

import prisma from '@/config/database';
import { SubmissionModel } from '@/models/submission.model';
import { runViewTrackingSnapshot } from './run-snapshot';
import logger from '@/utils/logger';

export interface ProcessDueResult {
  processed: number;
  errors: { reelUrl: string; error: string }[];
}

/**
 * Find and process all ACTIVE view_tracking_jobs where nextRunAt <= now.
 * Updates nextRunAt to now + intervalHours for each job after running the snapshot.
 */
export async function processDueViewTrackingJobs(): Promise<ProcessDueResult> {
  const result: ProcessDueResult = { processed: 0, errors: [] };

  try {
    // Use raw SQL so we don't depend on Prisma schema being regenerated (intervalHours, nextRunAt)
    const dueJobs = await prisma.$queryRaw<
      { id: string; reelUrl: string; intervalHours: number; nextRunAt: Date | null }[]
    >`
      SELECT id, "reelUrl", "intervalHours", "nextRunAt"
      FROM aimodule.view_tracking_jobs
      WHERE status = 'ACTIVE'
        AND ("nextRunAt" IS NULL OR "nextRunAt" <= NOW())
    `;

    if (dueJobs.length === 0) {
      return result;
    }

    logger.info({ count: dueJobs.length }, 'Processing due view-tracking jobs');

    for (const job of dueJobs) {
      try {
        const submission = await SubmissionModel.findByReelUrl(job.reelUrl);
        if (!submission) {
          logger.warn({ reelUrl: job.reelUrl }, 'No submission found for view-tracking job; skipping');
          result.errors.push({ reelUrl: job.reelUrl, error: 'No submission found' });
          // Still advance next_run_at so we don't spin on this job
          await advanceNextRunAt(job.id, job.intervalHours);
          continue;
        }

        const snapshotResult = await runViewTrackingSnapshot({
          reelSubmissionId: submission.id,
          reelUrl: job.reelUrl,
          campaignId: submission.campaignId,
        });

        if (!snapshotResult.success) {
          result.errors.push({
            reelUrl: job.reelUrl,
            error: snapshotResult.error || 'Snapshot failed',
          });
        } else {
          result.processed += 1;
        }

        // Advance next run time regardless of success (avoid hammering failed jobs every minute)
        await advanceNextRunAt(job.id, job.intervalHours);
      } catch (err: any) {
        logger.error({ err, jobId: job.id, reelUrl: job.reelUrl }, 'Error processing due view-tracking job');
        result.errors.push({ reelUrl: job.reelUrl, error: err?.message || 'Unknown error' });
        await advanceNextRunAt(job.id, job.intervalHours);
      }
    }

    return result;
  } catch (err: any) {
    logger.error({ err }, 'processDueViewTrackingJobs failed');
    throw err;
  }
}

async function advanceNextRunAt(jobId: string, intervalHours: number): Promise<void> {
  await prisma.$executeRaw`
    UPDATE aimodule.view_tracking_jobs
    SET "nextRunAt" = NOW() + (${intervalHours} * INTERVAL '1 hour'),
        "updatedAt" = NOW()
    WHERE id = (${jobId})::uuid
  `;
}
