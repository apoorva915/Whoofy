/**
 * Workers initialization
 * Start all background workers when the application starts
 */

import { getViewTrackingWorker } from './view-tracking-worker';
import logger from '@/utils/logger';

let workersStarted = false;

/**
 * Start all workers
 */
export function startWorkers(): void {
  if (workersStarted) {
    logger.warn('Workers already started');
    return;
  }

  try {
    // Start view tracking worker
    getViewTrackingWorker();
    
    workersStarted = true;
    logger.info('All workers started successfully');
  } catch (error) {
    logger.error({ error }, 'Error starting workers');
    throw error;
  }
}

/**
 * Stop all workers
 */
export async function stopWorkers(): Promise<void> {
  if (!workersStarted) {
    return;
  }

  try {
    // Workers will be cleaned up automatically when the process exits
    workersStarted = false;
    logger.info('Workers stopped');
  } catch (error) {
    logger.error({ error }, 'Error stopping workers');
  }
}
