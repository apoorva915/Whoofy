#!/usr/bin/env tsx
/**
 * Standalone view-tracking scheduler.
 * Runs process-due every minute so view snapshots keep running at the selected interval
 * even when npm run dev and the BullMQ worker are not running.
 *
 * Run in a separate process and keep it running (e.g. PM2, systemd, or a long-lived terminal):
 *   npx tsx scripts/run-view-tracking-scheduler.ts
 * or
 *   npm run scheduler:view-tracking
 *
 * The UI (Start Tracking / Stop Tracking / Fetch Snapshots) only controls which reels are tracked
 * and when the next run is due; this script (or cron calling /api/view-tracking/process-due) does the actual work.
 */

import 'dotenv/config';
import { processDueViewTrackingJobs } from '../src/services/view-tracking/process-due';
import logger from '../src/utils/logger';

const INTERVAL_MS = 60 * 1000; // 1 minute

async function tick() {
  try {
    const result = await processDueViewTrackingJobs();
    if (result.processed > 0 || result.errors.length > 0) {
      logger.info(
        { processed: result.processed, errors: result.errors.length },
        'View-tracking scheduler tick'
      );
      if (result.errors.length > 0) {
        result.errors.forEach((e) => logger.warn({ reelUrl: e.reelUrl, error: e.error }, 'Job error'));
      }
    }
  } catch (err) {
    logger.error({ err }, 'View-tracking scheduler tick failed');
  }
}

async function main() {
  logger.info('View-tracking scheduler started (runs every 1 minute). Press Ctrl+C to stop.');
  await tick();
  setInterval(tick, INTERVAL_MS);
}

main().catch((err) => {
  logger.error({ err }, 'Scheduler failed to start');
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('Shutting down view-tracking scheduler...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  logger.info('Shutting down view-tracking scheduler...');
  process.exit(0);
});
