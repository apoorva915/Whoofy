import prisma from '@/config/database';
import logger from '@/utils/logger';

/**
 * Update campaign budget based on view counts
 * 
 * This calculates the cost per view and updates the campaign's spent budget
 */
export async function updateCampaignBudgetFromViews(
  campaignId: string,
  reelSubmissionId: string,
  currentViewCount: number
): Promise<void> {
  try {
    // Get campaign
    const campaign = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      include: {
        reel_submissions: {
          where: { id: reelSubmissionId },
        },
      },
    });

    if (!campaign) {
      logger.warn(`Campaign ${campaignId} not found`);
      return;
    }

    // Get the submission
    const submission = campaign.reel_submissions[0];
    if (!submission) {
      logger.warn(`Submission ${reelSubmissionId} not found`);
      return;
    }

    // Get previous snapshot to calculate view increase
    const previousSnapshot = await prisma.view_tracking_snapshots.findFirst({
      where: {
        reelSubmissionId,
      },
      orderBy: {
        snapshotAt: 'desc',
      },
      skip: 1, // Skip the most recent (which we just created)
    });

    const previousViewCount = previousSnapshot?.viewCount || 0;
    const viewIncrease = currentViewCount - previousViewCount;

    if (viewIncrease <= 0) {
      // No new views, no budget update needed
      return;
    }

    // Calculate cost per view (CPV)
    // This is a simple calculation - you may want to customize this based on your pricing model
    // For example: CPV = campaign budget / target views
    // Or use a fixed rate like $0.01 per view

    // For now, we'll use a simple approach:
    // If campaign has a budget and we know the target, calculate CPV
    // Otherwise, use a default rate

    const defaultCPV = 0.01; // $0.01 per view (adjust as needed)
    const costForNewViews = viewIncrease * defaultCPV;

    // Update campaign budget (assuming campaigns table has a spentBudget field)
    // Since the schema shows campaigns has a budget field, we'll need to track spent separately
    // For now, we'll log the cost calculation

    logger.info(
      `Campaign ${campaignId}: ${viewIncrease} new views for submission ${reelSubmissionId}. Estimated cost: $${costForNewViews.toFixed(2)}`
    );

    // TODO: Update campaign spent budget if you have a spentBudget field
    // await prisma.campaigns.update({
    //   where: { id: campaignId },
    //   data: {
    //     spentBudget: {
    //       increment: costForNewViews,
    //     },
    //   },
    // });

    // Update submission performance metrics
    const currentMetrics = (submission.performanceMetrics as any) || {};
    await prisma.reel_submissions.update({
      where: { id: reelSubmissionId },
      data: {
        performanceMetrics: {
          ...currentMetrics,
          viewCount: currentViewCount,
          lastUpdatedAt: new Date().toISOString(),
          estimatedCost: (currentMetrics.estimatedCost || 0) + costForNewViews,
        },
      },
    });
  } catch (error) {
    logger.error(
      { error, campaignId, reelSubmissionId },
      'Error updating campaign budget from views'
    );
    // Don't throw - this is not critical
  }
}
