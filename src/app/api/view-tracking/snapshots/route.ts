import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/config/database';
import logger from '@/utils/logger';
import { normalizeReelUrlCanonical, extractInstagramReelId } from '@/utils/validation';

type SnapshotRow = {
  id: string;
  reelSubmissionId: string;
  reelUrl: string | null;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  snapshotAt: Date;
  isSpikeDetected: boolean;
  spikeReason: string | null;
  engagementRatio: number | null;
  engagementLabel: string | null;
};

/** Map DB row to API snapshot (handles null reelUrl from older rows) */
function toSnapshot(s: SnapshotRow) {
  return {
    id: s.id,
    reelUrl: s.reelUrl ?? undefined,
    viewCount: s.viewCount,
    likeCount: s.likeCount ?? undefined,
    commentCount: s.commentCount ?? undefined,
    shareCount: s.shareCount ?? undefined,
    snapshotAt: s.snapshotAt,
    isSpikeDetected: s.isSpikeDetected,
    spikeReason: s.spikeReason ?? undefined,
    engagementRatio: s.engagementRatio ?? undefined,
    engagementLabel: s.engagementLabel ?? undefined,
  };
}

/**
 * Get view tracking snapshots for a submission or reel URL.
 * Uses raw SQL for view_tracking_snapshots so null reelUrl (older rows) doesn't trigger Prisma P2032.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submissionId');
    const reelUrlParam = searchParams.get('reelUrl');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

    if (!submissionId && !reelUrlParam) {
      return NextResponse.json(
        { error: 'Either submissionId or reelUrl is required' },
        { status: 400 }
      );
    }

    let submissionIdToUse: string | null = submissionId;

    if (!submissionIdToUse && reelUrlParam) {
      const canonical = normalizeReelUrlCanonical(reelUrlParam);
      const reelId = extractInstagramReelId(canonical);

      if (reelId) {
        // Try to find snapshots by reel ID in reelUrl (raw SQL to allow null reelUrl in DB)
        const byUrl = await prisma.$queryRaw<SnapshotRow[]>`
          SELECT id, "reelSubmissionId", "reelUrl", "viewCount", "likeCount", "commentCount", "shareCount",
                 "snapshotAt", "isSpikeDetected", "spikeReason", "engagementRatio", "engagementLabel"
          FROM aimodule.view_tracking_snapshots
          WHERE "reelUrl"::text LIKE ${'%' + reelId + '%'}
          ORDER BY "snapshotAt" DESC
          LIMIT ${limit}
        `;
        const snapshotsByUrl = byUrl.filter(
          (s) => s.reelUrl != null && normalizeReelUrlCanonical(s.reelUrl) === canonical
        ).slice(0, limit);
        if (snapshotsByUrl.length > 0) {
          return NextResponse.json({
            success: true,
            snapshots: snapshotsByUrl.map(toSnapshot),
            count: snapshotsByUrl.length,
          });
        }
      }

      // Fallback: find submission by reel URL, then fetch by reelSubmissionId
      const submissionCandidates = reelId
        ? await prisma.reel_submissions.findMany({
            where: { reelUrl: { contains: reelId } },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : [];
      const submission = submissionCandidates.find(
        (s) => s.reelUrl && normalizeReelUrlCanonical(s.reelUrl) === canonical
      ) ?? null;
      if (!submission) {
        return NextResponse.json({
          success: true,
          snapshots: [],
          count: 0,
          message: 'No tracking data found for this reel URL',
        });
      }
      submissionIdToUse = submission.id;
    }
    if (!submissionIdToUse) {
      return NextResponse.json({
        success: true,
        snapshots: [],
        count: 0,
        message: 'No tracking data found for this reel URL',
      });
    }

    // Fetch by submission ID via raw SQL so null reelUrl rows don't cause P2032
    const snapshots = await prisma.$queryRaw<SnapshotRow[]>`
      SELECT id, "reelSubmissionId", "reelUrl", "viewCount", "likeCount", "commentCount", "shareCount",
             "snapshotAt", "isSpikeDetected", "spikeReason", "engagementRatio", "engagementLabel"
      FROM aimodule.view_tracking_snapshots
      WHERE "reelSubmissionId" = ${submissionIdToUse}
      ORDER BY "snapshotAt" DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      success: true,
      snapshots: snapshots.map(toSnapshot),
      count: snapshots.length,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting view tracking snapshots');
    return NextResponse.json(
      { error: error.message || 'Failed to get snapshots' },
      { status: 500 }
    );
  }
}
