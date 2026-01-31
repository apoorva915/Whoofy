#!/usr/bin/env tsx
/**
 * Standalone script to start the view tracking worker
 * Run this in a separate process: tsx scripts/start-view-tracking-worker.ts
 */

import 'dotenv/config';
import { startWorkers } from '../src/workers';
import logger from '../src/utils/logger';

// Start workers
startWorkers();

// Keep the process alive
logger.info('View tracking worker is running. Press Ctrl+C to stop.');

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down view tracking worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down view tracking worker...');
  process.exit(0);
});
