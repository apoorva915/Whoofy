import prisma from '@/config/database';
import { Submission, CreateSubmissionInput, UpdateSubmissionInput } from '@/types/submission';
import { NotFoundError, DatabaseError } from '@/utils/errors';
import logger from '@/utils/logger';
import { normalizeReelUrlCanonical, extractInstagramReelId } from '@/utils/validation';

/**
 * Submission Model - CRUD Operations
 *
 * NOTE: The current Prisma schema does not define a `submission` model. The
 * only place where we rely on the real database is `findByReelUrl`, which
 * uses the existing `reel_submissions` table. All other CRUD helpers are
 * implemented as stubs to keep the codebase compiling without mismatching
 * Prisma types.
 */
export const SubmissionModel = {
  /**
   * Create a new submission
   */
  async create(_data: CreateSubmissionInput): Promise<Submission> {
    throw new DatabaseError('SubmissionModel.create is not available in this deployment (no matching Prisma model).');
  },

  /**
   * Find submission by ID
   */
  async findById(_id: string): Promise<Submission | null> {
    return null;
  },

  /**
   * Find submission by ID or throw error
   */
  async findByIdOrThrow(id: string): Promise<Submission> {
    const submission = await this.findById(id);
    if (!submission) {
      throw new NotFoundError('Submission', id);
    }
    return submission;
  },

  /**
   * Find submission by reel URL (most recent if multiple).
   * Uses canonical URL so https://instagram.com/reel/ID/?hl=en matches https://instagram.com/reel/ID
   */
  async findByReelUrl(reelUrl: string): Promise<Submission | null> {
    try {
      const canonical = normalizeReelUrlCanonical(reelUrl);
      const reelId = extractInstagramReelId(canonical);
      if (!reelId) {
        return null;
      }

      // Find submissions that might match (by reel ID in URL), then match by canonical
      const candidates = await prisma.reel_submissions.findMany({
        where: { reelUrl: { contains: reelId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          campaigns: true,
          users: true,
        },
      });
      type Candidate = { reelUrl: string | null };
      const submission = candidates.find(
        (s: Candidate) => s.reelUrl && normalizeReelUrlCanonical(s.reelUrl) === canonical
      );
      if (!submission) {
        return null;
      }

      return {
        id: submission.id,
        campaignId: submission.campaignId,
        creatorId: submission.creatorId,
        reelUrl: submission.reelUrl,
        reelId: submission.reelUrl?.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] || null,
        caption: null,
        status: submission.reviewStatus as any,
        submittedAt: submission.submittedAt,
        verifiedAt: submission.aiAnalysisTimestamp || null,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      };
    } catch (error) {
      logger.error({ error, reelUrl }, 'Error finding submission by reel URL');
      return null;
    }
  },

  /**
   * Find all submissions with pagination
   */
  async findAll(_options: {
    page?: number;
    limit?: number;
    campaignId?: string;
    creatorId?: string;
    status?: string;
  } = {}): Promise<{ submissions: Submission[]; total: number }> {
    return { submissions: [], total: 0 };
  },

  /**
   * Update submission
   */
  async update(_id: string, _data: UpdateSubmissionInput): Promise<Submission> {
    throw new DatabaseError('SubmissionModel.update is not available in this deployment (no matching Prisma model).');
  },

  /**
   * Delete submission
   */
  async delete(_id: string): Promise<void> {
    // no-op
  },

  /**
   * Map Prisma model to Submission type
   */
  mapToSubmission(submission: any): Submission {
    return {
      id: submission.id,
      campaignId: submission.campaignId,
      creatorId: submission.creatorId,
      reelUrl: submission.reelUrl,
      reelId: submission.reelId,
      caption: submission.caption,
      status: submission.status as any,
      submittedAt: submission.submittedAt,
      verifiedAt: submission.verifiedAt,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  },
};