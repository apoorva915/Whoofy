import prisma from '@/config/database';
import { Submission, CreateSubmissionInput, UpdateSubmissionInput } from '@/types/submission';
import { NotFoundError, DatabaseError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Submission Model - CRUD Operations
 */
export const SubmissionModel = {
  /**
   * Create a new submission
   */
  async create(data: CreateSubmissionInput): Promise<Submission> {
    try {
      const submission = await prisma.submission.create({
        data: {
          ...data,
        },
        include: {
          campaign: true,
          creator: true,
        },
      });
      
      logger.info(`Submission created: ${submission.id}`);
      return this.mapToSubmission(submission);
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new DatabaseError('Campaign or Creator not found');
      }
      logger.error({ error }, 'Error creating submission');
      throw new DatabaseError('Failed to create submission', error);
    }
  },

  /**
   * Find submission by ID
   */
  async findById(id: string): Promise<Submission | null> {
    try {
      const submission = await prisma.submission.findUnique({
        where: { id },
        include: {
          campaign: true,
          creator: true,
          verificationResult: true,
        },
      });
      
      return submission ? this.mapToSubmission(submission) : null;
    } catch (error) {
      logger.error({ error }, 'Error finding submission:', error);
      throw new DatabaseError('Failed to find submission', error);
    }
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
   * Find all submissions with pagination
   */
  async findAll(options: {
    page?: number;
    limit?: number;
    campaignId?: string;
    creatorId?: string;
    status?: string;
  } = {}): Promise<{ submissions: Submission[]; total: number }> {
    try {
      const { page = 1, limit = 20, campaignId, creatorId, status } = options;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (campaignId) where.campaignId = campaignId;
      if (creatorId) where.creatorId = creatorId;
      if (status) where.status = status;

      const [submissions, total] = await Promise.all([
        prisma.submission.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            campaign: true,
            creator: true,
          },
        }),
        prisma.submission.count({ where }),
      ]);

      return {
        submissions: submissions.map(this.mapToSubmission),
        total,
      };
    } catch (error) {
      logger.error({ error }, 'Error finding submissions:', error);
      throw new DatabaseError('Failed to find submissions', error);
    }
  },

  /**
   * Update submission
   */
  async update(id: string, data: UpdateSubmissionInput): Promise<Submission> {
    try {
      const submission = await prisma.submission.update({
        where: { id },
        data,
      });

      logger.info(`Submission updated: ${id}`);
      return this.mapToSubmission(submission);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Submission', id);
      }
      logger.error({ error }, 'Error updating submission:', error);
      throw new DatabaseError('Failed to update submission', error);
    }
  },

  /**
   * Delete submission
   */
  async delete(id: string): Promise<void> {
    try {
      await prisma.submission.delete({
        where: { id },
      });
      logger.info(`Submission deleted: ${id}`);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Submission', id);
      }
      logger.error({ error }, 'Error deleting submission:', error);
      throw new DatabaseError('Failed to delete submission', error);
    }
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
