import {
  VerificationResult,
  CreateVerificationResultInput,
} from '@/types/verification';
import { NotFoundError, DatabaseError } from '@/utils/errors';

/**
 * Verification Result Model
 *
 * NOTE: The current Prisma schema does not define a `verificationResult`
 * model/table. To avoid mismatches between Prisma types and the database,
 * this module is provided as a stub. If these methods are called, they will
 * either return `null` or throw a `DatabaseError` with a clear message.
 */
export const VerificationResultModel = {
  async create(_data: CreateVerificationResultInput): Promise<VerificationResult> {
    throw new DatabaseError('VerificationResultModel.create is not available in this deployment (no matching Prisma model).');
  },

  async findById(_id: string): Promise<VerificationResult | null> {
    return null;
  },

  async findBySubmissionId(_submissionId: string): Promise<VerificationResult | null> {
    return null;
  },  async findBySubmissionIdOrThrow(submissionId: string): Promise<VerificationResult> {
    const result = await this.findBySubmissionId(submissionId);
    if (!result) {
      throw new NotFoundError('VerificationResult', submissionId);
    }
    return result;
  },

  async update(
    _id: string,
    _data: Partial<CreateVerificationResultInput>
  ): Promise<VerificationResult> {
    throw new DatabaseError('VerificationResultModel.update is not available in this deployment (no matching Prisma model).');
  },  async delete(_id: string): Promise<void> {
    // no-op
  },  mapToVerificationResult(result: any): VerificationResult {
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