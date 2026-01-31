import { NextRequest, NextResponse } from 'next/server';
import { removeViewTrackingJob, getQueueStats } from '@/workers/queue';
import { SubmissionModel } from '@/models/submission.model';
import logger from '@/utils/logger';
import { z } from 'zod';
import prisma from '@/config/database';
import { v4 as uuidv4 } from 'uuid';
import { normalizeReelUrlCanonical } from '@/utils/validation';

// View tracking is now DB-driven: jobs run at nextRunAt; a standalone scheduler (or cron calling process-due) processes due jobs.
// No need to start the BullMQ worker for scheduling; the UI is used to start/stop tracking and view snapshots.

/**
 * Start view tracking for a submission or reel URL
 * POST /api/view-tracking
 * Body: { submissionId?: string, reelUrl?: string, intervalHours: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const schema = z.object({
      submissionId: z.string().optional(),
      reelUrl: z.string().optional(),
      // Support minutes or hours: 1/60 (1 min) to 24 (24 hours). UI sends decimal hours (e.g. 0.5 = 30 mins, 1 = 1 hr).
      intervalHours: z.number().min(1 / 60).max(24).default(1),
    });

    const { submissionId, reelUrl, intervalHours } = schema.parse(body);

    if (!submissionId && !reelUrl) {
      return NextResponse.json(
        { error: 'Either submissionId or reelUrl is required' },
        { status: 400 }
      );
    }

    let submission;
    if (submissionId) {
      submission = await SubmissionModel.findByIdOrThrow(submissionId);
    } else if (reelUrl) {
      // Normalize and find by canonical URL so ?hl=en etc. match
      const normalizedUrl = normalizeReelUrlCanonical(reelUrl);
      submission = await SubmissionModel.findByReelUrl(normalizedUrl);
      
      if (!submission) {
        // Auto-create a minimal submission for view tracking
        logger.info(`No submission found for ${normalizedUrl}, creating one automatically`);
        
        try {
          // Get or create a default campaign (for view tracking purposes)
          let defaultCampaign = await prisma.campaigns.findFirst({
            orderBy: { createdAt: 'desc' },
          });
          
          // Get or create a default user/creator first (needed for both campaign and submission)
          let defaultCreator = await prisma.users.findFirst({
            where: { role: 'CREATOR' },
            orderBy: { createdAt: 'desc' },
          });
          
          if (!defaultCreator) {
            // Create a minimal default creator
            const creatorId = uuidv4();
            defaultCreator = await prisma.users.create({
              data: {
                id: creatorId,
                name: 'View Tracking User',
                email: `view-tracking-${Date.now()}@whoofy.local`,
                role: 'CREATOR',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            logger.info(`Created default creator: ${creatorId}`);
          }
          
          // Get or create a default brand user (campaigns.brandId references users.id)
          let defaultBrandUser = await prisma.users.findFirst({
            where: { role: 'BRAND' },
            orderBy: { createdAt: 'desc' },
          });
          
          if (!defaultBrandUser) {
            // Create a minimal default brand user
            const brandUserId = uuidv4();
            defaultBrandUser = await prisma.users.create({
              data: {
                id: brandUserId,
                name: 'View Tracking Brand',
                email: `view-tracking-brand-${Date.now()}@whoofy.local`,
                role: 'BRAND',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            logger.info(`Created default brand user: ${brandUserId}`);
          }
          
          if (!defaultCampaign) {
            // Create a minimal default campaign
            const campaignId = uuidv4();
            defaultCampaign = await prisma.campaigns.create({
              data: {
                id: campaignId,
                title: 'View Tracking Campaign',
                description: 'Auto-created for view tracking',
                budget: 0,
                startDate: new Date(),
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
                status: 'Active',
                brandId: defaultBrandUser.id, // campaigns.brandId references users.id
                platforms: ['Instagram'],
                type: 'UGC',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            logger.info(`Created default campaign: ${campaignId}`);
          }
          
          // Create submission (store canonical URL for consistent lookups)
          const submissionId = uuidv4();
          await prisma.reel_submissions.create({
            data: {
              id: submissionId,
              campaignId: defaultCampaign.id,
              creatorId: defaultCreator.id,
              reelUrl: normalizedUrl,
              submittedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              reviewStatus: 'PENDING',
            },
          });
          
          logger.info(`Auto-created submission ${submissionId} for reel ${normalizedUrl}`);
          
          // Fetch the created submission
          submission = await SubmissionModel.findByReelUrl(normalizedUrl);
          
          if (!submission) {
            throw new Error('Failed to retrieve created submission');
          }
        } catch (error: any) {
          logger.error({ error, reelUrl: normalizedUrl }, 'Failed to auto-create submission');
          return NextResponse.json(
            { 
              success: false,
              error: `Failed to create submission automatically: ${error.message}`,
              reelUrl: normalizedUrl,
            },
            { status: 500 }
          );
        }
      }
    }

    // Ensure we have a non-null reel URL for job payload and view_tracking_jobs (both require non-null)
    const reelUrlForJob = submission.reelUrl ?? reelUrl ?? '';
    const canonicalReelUrl = normalizeReelUrlCanonical(reelUrlForJob);
    if (!canonicalReelUrl) {
      return NextResponse.json(
        { error: 'Submission does not have a reel URL and none was provided' },
        { status: 400 }
      );
    }

    // DB-driven scheduling: store interval and next_run_at. A standalone scheduler (or cron calling process-due) runs snapshots at the chosen interval—no need for npm run dev or the BullMQ worker to be running.
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM aimodule.view_tracking_jobs WHERE "reelUrl" = ${canonicalReelUrl} ORDER BY "updatedAt" DESC LIMIT 1
    `.then((rows) => rows?.[0]);
    const nextRunAt = new Date(); // First run due immediately when scheduler runs
    if (existing) {
      await prisma.$executeRaw`
        UPDATE aimodule.view_tracking_jobs
        SET status = 'ACTIVE', "intervalHours" = ${intervalHours}, "nextRunAt" = ${nextRunAt}, "updatedAt" = NOW()
        WHERE id = (${existing.id})::uuid
      `;
    } else {
      const jobId = uuidv4();
      await prisma.$executeRaw`
        INSERT INTO aimodule.view_tracking_jobs (id, "reelUrl", status, "intervalHours", "nextRunAt", "createdAt", "updatedAt")
        VALUES (${jobId}::uuid, ${canonicalReelUrl}, 'ACTIVE', ${intervalHours}, ${nextRunAt}, NOW(), NOW())
      `;
    }

    logger.info(
      `Started view tracking for submission ${submission.id} (reelUrl: ${submission.reelUrl}, interval: ${intervalHours} hours)`
    );

    return NextResponse.json({
      success: true,
      message: `View tracking started for reel ${canonicalReelUrl}`,
      submissionId: submission.id,
      reelUrl: canonicalReelUrl,
      intervalHours,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error starting view tracking');
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to start view tracking' },
      { status: 500 }
    );
  }
}

/**
 * Stop view tracking for a submission or reel URL
 * DELETE /api/view-tracking?submissionId=xxx
 * DELETE /api/view-tracking?reelUrl=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submissionId');
    const reelUrl = searchParams.get('reelUrl');

    if (!submissionId && !reelUrl) {
      return NextResponse.json(
        { error: 'Either submissionId or reelUrl is required' },
        { status: 400 }
      );
    }

    let finalSubmissionId = submissionId;
    let normalizedReelUrl: string | null = null;

    if (!finalSubmissionId && reelUrl) {
      normalizedReelUrl = normalizeReelUrlCanonical(reelUrl);
      const submission = await SubmissionModel.findByReelUrl(normalizedReelUrl);
      if (!submission) {
        return NextResponse.json(
          { error: 'No submission found for this reel URL' },
          { status: 404 }
        );
      }
      finalSubmissionId = submission.id;
    } else if (finalSubmissionId) {
      const sub = await SubmissionModel.findById(finalSubmissionId).catch(() => null);
      if (sub?.reelUrl) {
        normalizedReelUrl = sub.reelUrl.startsWith('http') ? sub.reelUrl : `https://${sub.reelUrl}`;
      }
    }

    await removeViewTrackingJob(finalSubmissionId!);

    // Mark view_tracking_jobs as STOPPED (raw SQL for bundle-safe access)
    if (normalizedReelUrl) {
      const canonical = normalizeReelUrlCanonical(normalizedReelUrl);
      const activeJobs = await prisma.$queryRaw<{ id: string; reelUrl: string }[]>`
        SELECT id, "reelUrl" FROM aimodule.view_tracking_jobs WHERE status = 'ACTIVE'
      `;
      const active = activeJobs.find((j) => normalizeReelUrlCanonical(j.reelUrl) === canonical);
      if (active) {
        await prisma.$executeRaw`
          UPDATE aimodule.view_tracking_jobs SET status = 'STOPPED', "updatedAt" = NOW() WHERE id = (${active.id})::uuid
        `;
      }
    }

    logger.info(`Stopped view tracking for submission ${finalSubmissionId}`);

    return NextResponse.json({
      success: true,
      message: `View tracking stopped for submission ${finalSubmissionId}`,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error stopping view tracking');
    return NextResponse.json(
      { error: error.message || 'Failed to stop view tracking' },
      { status: 500 }
    );
  }
}

/**
 * Get view tracking info
 * GET /api/view-tracking
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'View tracking API is running. Use /api/view-tracking/stats for queue statistics.',
      endpoints: {
        stats: '/api/view-tracking/stats',
        start: 'POST /api/view-tracking',
        stop: 'DELETE /api/view-tracking?submissionId=xxx',
        snapshots: 'GET /api/view-tracking/snapshots?submissionId=xxx',
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error in view tracking GET');
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
