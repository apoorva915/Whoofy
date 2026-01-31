/**
 * Process due view-tracking jobs (DB-driven scheduling).
 * GET or POST /api/view-tracking/process-due
 * Call this every minute from a cron job or standalone scheduler so tracking continues
 * even when npm run dev and the BullMQ worker are not running.
 */

import { NextResponse } from 'next/server';
import { processDueViewTrackingJobs } from '@/services/view-tracking/process-due';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  return runProcessDue();
}

export async function POST() {
  return runProcessDue();
}

async function runProcessDue() {
  try {
    const result = await processDueViewTrackingJobs();
    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error({ error }, 'process-due API failed');
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to process due jobs',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
