import { NextRequest, NextResponse } from 'next/server';
import { removeViewTrackingJob } from '@/workers/queue';
import { SubmissionModel } from '@/models/submission.model';
import logger from '@/utils/logger';
import { z } from 'zod';
import prisma from '@/config/database';
import { v4 as uuidv4 } from 'uuid';
import { normalizeReelUrlCanonical } from '@/utils/validation';

/**
 * Start view tracking for a submission or reel URL
 * POST /api/view-tracking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const schema = z.object({
      submissionId: z.string().optional(),
      reelUrl: z.string().optional(),
      intervalHours: z.number().min(1 / 60).max(24).default(1),
    });

    const { submissionId, reelUrl, intervalHours } = schema.parse(body);

    if (!submissionId && !reelUrl) {
      return NextResponse.json(
        { error: 'Either submissionId or reelUrl is required' },
        { status: 400 }
      );
    }

    let submission: { id: string; reelUrl: string } | null = null;
    const now = new Date();

    /* ------------------------------------------------------------------ */
    /* Fetch or auto-create submission */
    /* ------------------------------------------------------------------ */

    if (submissionId) {
      submission = await SubmissionModel.findByIdOrThrow(submissionId);
    } else if (reelUrl) {
      const normalizedUrl = normalizeReelUrlCanonical(reelUrl);

      if (!normalizedUrl) {
        return NextResponse.json(
          { error: 'Invalid reel URL' },
          { status: 400 }
        );
      }

      submission = await SubmissionModel.findByReelUrl(normalizedUrl);

      if (!submission) {
        logger.info(`No submission found for ${normalizedUrl}, auto-creating`);

        try {
          /* ------------------ Creator ------------------ */
          let defaultCreator = await prisma.users.findFirst({
            where: { role: 'CREATOR' },
            orderBy: { createdAt: 'desc' },
          });

          if (!defaultCreator) {
            defaultCreator = await prisma.users.create({
              data: {
                id: uuidv4(),
                name: 'View Tracking User',
                email: `view-tracking-${Date.now()}@whoofy.local`,
                role: 'CREATOR',
                createdAt: now,
                updatedAt: now,
              },
            });
          }

          /* ------------------ Brand User ------------------ */
          let defaultBrand = await prisma.users.findFirst({
            where: { role: 'BRAND' },
            orderBy: { createdAt: 'desc' },
          });

          if (!defaultBrand) {
            defaultBrand = await prisma.users.create({
              data: {
                id: uuidv4(),
                name: 'View Tracking Brand',
                email: `view-tracking-brand-${Date.now()}@whoofy.local`,
                role: 'BRAND',
                createdAt: now,
                updatedAt: now,
              },
            });
          }

          /* ------------------ Campaign ------------------ */
          let campaign = await prisma.campaigns.findFirst({
            orderBy: { createdAt: 'desc' },
          });

          if (!campaign) {
            campaign = await prisma.campaigns.create({
              data: {
                id: uuidv4(),
                title: 'View Tracking Campaign',
                description: 'Auto-created for view tracking',
                budget: 0,
                startDate: now,
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                status: 'Active',
                brandId: defaultBrand.id,
                platforms: ['Instagram'],
                type: 'UGC',
                createdAt: now,
                updatedAt: now,
              },
            });
          }

          /* ------------------ Submission ------------------ */
          const newSubmissionId = uuidv4();

          await prisma.reel_submissions.create({
            data: {
              id: newSubmissionId,
              campaignId: campaign.id,
              creatorId: defaultCreator.id,
              reelUrl: normalizedUrl,
              reviewStatus: 'PENDING',
              submittedAt: now,
              createdAt: now,
              updatedAt: now,
            },
          });

          submission = await SubmissionModel.findByReelUrl(normalizedUrl);

          if (!submission) {
            throw new Error('Failed to retrieve auto-created submission');
          }
        } catch (error: any) {
          logger.error({ error }, 'Auto-create submission failed');
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* Hard guarantee */
    /* ------------------------------------------------------------------ */

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission could not be resolved' },
        { status: 400 }
      );
    }

    const canonicalReelUrl = normalizeReelUrlCanonical(submission.reelUrl);

    if (!canonicalReelUrl) {
      return NextResponse.json(
        { error: 'Invalid reel URL after normalization' },
        { status: 400 }
      );
    }

    /* ------------------------------------------------------------------ */
    /* Schedule or update job */
    /* ------------------------------------------------------------------ */

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM aimodule.view_tracking_jobs
      WHERE "reelUrl" = ${canonicalReelUrl}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `.then((rows: { id: string }[]) => rows?.[0]);

    const nextRunAt = now;

    if (existing) {
      await prisma.$executeRaw`
        UPDATE aimodule.view_tracking_jobs
        SET status = 'ACTIVE',
            "intervalHours" = ${intervalHours},
            "nextRunAt" = ${nextRunAt},
            "updatedAt" = NOW()
        WHERE id = (${existing.id})::uuid
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO aimodule.view_tracking_jobs
        (id, "reelUrl", status, "intervalHours", "nextRunAt", "createdAt", "updatedAt")
        VALUES
        (${uuidv4()}::uuid, ${canonicalReelUrl}, 'ACTIVE', ${intervalHours}, ${nextRunAt}, NOW(), NOW())
      `;
    }

    logger.info(`Started view tracking for ${canonicalReelUrl}`);

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      reelUrl: canonicalReelUrl,
      intervalHours,
    });
  } catch (error: any) {
    logger.error({ error }, 'View tracking start failed');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
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
 * Stop view tracking
 * DELETE /api/view-tracking
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submissionId');
    const reelUrlParam = searchParams.get('reelUrl');

    if (!submissionId && !reelUrlParam) {
      return NextResponse.json(
        { error: 'Either submissionId or reelUrl is required' },
        { status: 400 }
      );
    }

    let resolvedSubmissionId = submissionId;

    // Allow stopping by reelUrl (what the frontend sends)
    if (!resolvedSubmissionId && reelUrlParam) {
      const canonical = normalizeReelUrlCanonical(reelUrlParam);
      if (!canonical) {
        return NextResponse.json(
          { error: 'Invalid reel URL' },
          { status: 400 }
        );
      }

      const submission = await SubmissionModel.findByReelUrl(canonical);
      if (!submission) {
        return NextResponse.json(
          { error: 'No submission found for this reel URL' },
          { status: 404 }
        );
      }
      resolvedSubmissionId = submission.id;

      // Deactivate any DB-driven jobs for this reel so the scheduler stops running it
      await prisma.$executeRaw`
        UPDATE aimodule.view_tracking_jobs
        SET status = 'INACTIVE',
            "updatedAt" = NOW()
        WHERE "reelUrl" = ${canonical}
      `;
    }

    if (!resolvedSubmissionId) {
      return NextResponse.json(
        { error: 'Submission could not be resolved' },
        { status: 400 }
      );
    }

    // Remove any BullMQ-based repeatable jobs that might exist (backwards compatibility)
    await removeViewTrackingJob(resolvedSubmissionId);

    return NextResponse.json({
      success: true,
      message: `View tracking stopped for submission ${resolvedSubmissionId}`,
    });
  } catch (error: any) {
    logger.error({ error }, 'View tracking stop failed');
    return NextResponse.json(
      { error: error.message || 'Failed to stop view tracking' },
      { status: 500 }
    );
  }
}

/**
 * Health check
 * GET /api/view-tracking
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'View tracking API is running',
  });
}
