import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/config/database';
import { normalizeReelUrlCanonical } from '@/utils/validation';

type ViewTrackingJobRow = { id: string; reelUrl: string; status: string };

/**
 * Check if a reel is currently being tracked
 * GET /api/view-tracking/status?reelUrl=xxx
 * Uses canonical URL so https://instagram.com/reel/ID/?hl=en matches https://instagram.com/reel/ID
 * Uses raw query so it works even if Prisma client omits aimodule models in the bundle.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reelUrl = searchParams.get('reelUrl');

    if (!reelUrl) {
      return NextResponse.json(
        { error: 'reelUrl is required' },
        { status: 400 }
      );
    }

    const canonical = normalizeReelUrlCanonical(reelUrl);

    const activeJobs = (await prisma.$queryRaw<ViewTrackingJobRow[]>`
      SELECT id, "reelUrl", status
      FROM aimodule.view_tracking_jobs
      WHERE status = 'ACTIVE'
    `);
    const activeTracking = activeJobs.find(
      (job: ViewTrackingJobRow) => normalizeReelUrlCanonical(job.reelUrl) === canonical
    );

    return NextResponse.json({
      success: true,
      isTracking: !!activeTracking,
    });
  } catch (error: any) {
    console.error('Error checking tracking status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check tracking status' },
      { status: 500 }
    );
  }
}