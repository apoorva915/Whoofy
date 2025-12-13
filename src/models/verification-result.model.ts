import prisma from '@/config/database';
import {
  VerificationResult,
  CreateVerificationResultInput,
} from '@/types/verification';
import { NotFoundError, DatabaseError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Verification Result Model - CRUD Operations
 */
export const VerificationResultModel = {
  /**
   * Create a new verification result
   */
  async create(data: CreateVerificationResultInput): Promise<VerificationResult> {
    try {
      const result = await prisma.verificationResult.create({
        data: {
          ...data,
          detectionResults: data.detectionResults as any,
          creatorEligibility: data.creatorEligibility as any,
          contentAuthenticity: data.contentAuthenticity as any,
          brandIntegration: data.brandIntegration as any,
          campaignRules: data.campaignRules as any,
        },
      });
      
      logger.info(`Verification result created: ${result.id}`);
      return this.mapToVerificationResult(result);
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new DatabaseError('Submission not found');
      }
      if (error.code === 'P2002') {
        throw new DatabaseError('Verification result already exists for this submission');
      }
      logger.error('Error creating verification result:', error);
      throw new DatabaseError('Failed to create verification result', error);
    }
  },

  /**
   * Find verification result by ID
   */
  async findById(id: string): Promise<VerificationResult | null> {
    try {
      const result = await prisma.verificationResult.findUnique({
        where: { id },
        include: {
          submission: {
            include: {
              campaign: true,
              creator: true,
            },
          },
        },
      });
      
      return result ? this.mapToVerificationResult(result) : null;
    } catch (error) {
      logger.error('Error finding verification result:', error);
      throw new DatabaseError('Failed to find verification result', error);
    }
  },

  /**
   * Find verification result by submission ID
   */
  async findBySubmissionId(submissionId: string): Promise<VerificationResult | null> {
    try {
      const result = await prisma.verificationResult.findUnique({
        where: { submissionId },
        include: {
          submission: {
            include: {
              campaign: true,
              creator: true,
            },
          },
        },
      });
      
      return result ? this.mapToVerificationResult(result) : null;
    } catch (error) {
      logger.error('Error finding verification result by submission:', error);
      throw new DatabaseError('Failed to find verification result', error);
    }
  },

  /**
   * Find verification result by submission ID or throw error
   */
  async findBySubmissionIdOrThrow(submissionId: string): Promise<VerificationResult> {
    const result = await this.findBySubmissionId(submissionId);
    if (!result) {
      throw new NotFoundError('VerificationResult', submissionId);
    }
    return result;
  },

  /**
   * Update verification result
   */
  async update(
    id: string,
    data: Partial<CreateVerificationResultInput>
  ): Promise<VerificationResult> {
    try {
      const updateData: any = { ...data };
      
      if (data.detectionResults) {
        updateData.detectionResults = data.detectionResults as any;
      }
      if (data.creatorEligibility) {
        updateData.creatorEligibility = data.creatorEligibility as any;
      }
      if (data.contentAuthenticity) {
        updateData.contentAuthenticity = data.contentAuthenticity as any;
      }
      if (data.brandIntegration) {
        updateData.brandIntegration = data.brandIntegration as any;
      }
      if (data.campaignRules) {
        updateData.campaignRules = data.campaignRules as any;
      }

      const result = await prisma.verificationResult.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Verification result updated: ${id}`);
      return this.mapToVerificationResult(result);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('VerificationResult', id);
      }
      logger.error('Error updating verification result:', error);
      throw new DatabaseError('Failed to update verification result', error);
    }
  },

  /**
   * Delete verification result
   */
  async delete(id: string): Promise<void> {
    try {
      await prisma.verificationResult.delete({
        where: { id },
      });
      logger.info(`Verification result deleted: ${id}`);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('VerificationResult', id);
      }
      logger.error('Error deleting verification result:', error);
      throw new DatabaseError('Failed to delete verification result', error);
    }
  },

  /**
   * Map Prisma model to VerificationResult type
   */
  mapToVerificationResult(result: any): VerificationResult {
    return {
      id: result.id,
      submissionId: result.submissionId,
      status: result.status as any,
      overallScore: result.overallScore,
      detectionResults: result.detectionResults,
      creatorEligibility: result.creatorEligibility,
      contentAuthenticity: result.contentAuthenticity,
      brandIntegration: result.brandIntegration,
      campaignRules: result.campaignRules,
      processingTimeMs: result.processingTimeMs,
      errorMessage: result.errorMessage,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  },
};
