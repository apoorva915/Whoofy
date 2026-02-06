/**
 * Shared logic for running one view-tracking snapshot.
 * Used by the BullMQ worker and by the DB-driven scheduler (process-due).
 */

import { externalApiService } from '@/services/external';
import prisma from '@/config/database';
import logger from '@/utils/logger';
import { detectViewSpike } from '@/services/verification/view-spike-detection';
import { updateCampaignBudgetFromViews } from '@/services/campaign/budget-updater';
import { ENGAGEMENT_RATIO_THRESHOLDS, ENGAGEMENT_RATIO_LABELS } from '@/utils/constants';

export interface RunSnapshotInput {
  reelSubmissionId: string;
  reelUrl: string;
  campaignId: string;
}

export interface RunSnapshotResult {
  success: boolean;
  viewCount?: number;
  spikeDetected?: boolean;
  snapshotId?: string;
  error?: string;
}

export async function runViewTrackingSnapshot(input: RunSnapshotInput): Promise<RunSnapshotResult> {
  const { reelSubmissionId, reelUrl, campaignId } = input;

  if (!reelUrl?.trim()) {
    logger.error({ reelSubmissionId }, 'runViewTrackingSnapshot: missing reelUrl');
    return { success: false, error: 'Missing reelUrl' };
  }

  try {
    const reelMetadata = await externalApiService.getInstagramReel(reelUrl);
    const currentViewCount = reelMetadata.playCount || 0;
    const currentLikeCount = reelMetadata.likeCount || 0;
    const currentCommentCount = reelMetadata.commentCount || 0;

    logger.info(
      `Fetched views for ${reelSubmissionId}: ${currentViewCount} views, ${currentLikeCount} likes, ${currentCommentCount} comments`
    );

    const previousSnapshots = await prisma.view_tracking_snapshots.findMany({
      where: { reelSubmissionId },
      orderBy: { snapshotAt: 'desc' },
      take: 10,
    });

    type SnapshotRow = { viewCount: number; likeCount: number | null; snapshotAt: Date };
    const spikeResult = detectViewSpike(
      currentViewCount,
      previousSnapshots.map((s: SnapshotRow) => ({
        viewCount: s.viewCount,
        likeCount: s.likeCount || 0,
        timestamp: s.snapshotAt,
      })),
      currentLikeCount
    );

    const currentShareCount = (reelMetadata as any).shareCount ?? 0;
    const saves = 0;
    const totalEngagement = currentLikeCount + currentCommentCount + currentShareCount + saves;
    const engagementRatio = currentViewCount > 0 ? totalEngagement / currentViewCount : 0;
    const engagementRatioPercentage = engagementRatio * 100;

    let engagementLabel: string;
    if (engagementRatioPercentage < ENGAGEMENT_RATIO_THRESHOLDS.SUSPICIOUS) {
      engagementLabel = ENGAGEMENT_RATIO_LABELS.SUSPICIOUS;
    } else if (
      engagementRatioPercentage >= ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MIN &&
      engagementRatioPercentage <= ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MAX
    ) {
      engagementLabel = ENGAGEMENT_RATIO_LABELS.AVERAGE;
    } else if (engagementRatioPercentage >= ENGAGEMENT_RATIO_THRESHOLDS.STRONG_MIN) {
      engagementLabel = ENGAGEMENT_RATIO_LABELS.STRONG;
    } else {
      engagementLabel = ENGAGEMENT_RATIO_LABELS.AVERAGE;
    }

    const snapshot = await prisma.view_tracking_snapshots.create({
      data: {
        reelSubmissionId,
        reelUrl,
        viewCount: currentViewCount,
        likeCount: currentLikeCount,
        commentCount: currentCommentCount,
        shareCount: currentShareCount,
        isSpikeDetected: spikeResult.isSpike,
        spikeReason: spikeResult.reason || null,
        engagementRatio: engagementRatioPercentage,
        engagementLabel,
        snapshotAt: new Date(),
      },
    });

    logger.info(
      `Saved snapshot for ${reelSubmissionId}: ${currentViewCount} views, Engagement Ratio: ${engagementRatioPercentage.toFixed(2)}% (${engagementLabel})${spikeResult.isSpike ? ` (SPIKE: ${spikeResult.reason})` : ''}`
    );

    if (spikeResult.isSpike) {
      await prisma.reel_submissions.update({
        where: { id: reelSubmissionId },
        data: {
          reviewStatus: 'REJECTED',
          feedback: `View spike detected: ${spikeResult.reason}. This submission may be fraudulent.`,
        },
      });
      logger.warn(`View spike detected for submission ${reelSubmissionId}. Marked as REJECTED.`);
    }

    await updateCampaignBudgetFromViews(campaignId, reelSubmissionId, currentViewCount);

    return {
      success: true,
      viewCount: currentViewCount,
      spikeDetected: spikeResult.isSpike,
      snapshotId: snapshot.id,
    };
  } catch (error: any) {
    logger.error(
      { error, reelSubmissionId, reelUrl },
      'runViewTrackingSnapshot: error'
    );
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
}
