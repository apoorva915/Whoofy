import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats } from '@/workers/queue';
import { getViewTrackingWorker } from '@/workers/view-tracking-worker';
import { getRedisClient } from '@/config/redis';
import logger from '@/utils/logger';

// Initialize worker on first API call (lazy initialization)
let workerInitialized = false;
function ensureWorkerInitialized() {
  if (!workerInitialized) {
    try {
      getViewTrackingWorker();
      workerInitialized = true;
      logger.info('View tracking worker initialized');
    } catch (error: any) {
      logger.error({ error }, 'Failed to initialize view tracking worker');
      throw error;
    }
  }
}

/**
 * Get queue statistics
 * GET /api/view-tracking/stats
 */
export async function GET(request: NextRequest) {
  try {
    // Test Redis connection first
    try {
      const redis = getRedisClient();
      await redis.ping();
      logger.info('Redis connection verified');
    } catch (redisError: any) {
      logger.error({ error: redisError }, 'Redis connection failed');
      return NextResponse.json(
        {
          success: false,
          error: 'Redis connection failed',
          message: redisError.message,
          details: process.env.NODE_ENV === 'development' ? {
            stack: redisError.stack,
          } : undefined,
        },
        { status: 500 }
      );
    }

    // Ensure worker is initialized
    try {
      ensureWorkerInitialized();
    } catch (workerError: any) {
      logger.error({ error: workerError }, 'Worker initialization failed');
      return NextResponse.json(
        {
          success: false,
          error: 'Worker initialization failed',
          message: workerError.message,
          details: process.env.NODE_ENV === 'development' ? {
            stack: workerError.stack,
          } : undefined,
        },
        { status: 500 }
      );
    }

    // Get queue stats
    const stats = await getQueueStats();
    
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    logger.error({ error, stack: error.stack }, 'Error getting queue stats');
    
    // Return detailed error for debugging
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to get queue stats',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : undefined,
      },
      { status: 500 }
    );
  }
}
