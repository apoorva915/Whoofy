import { z } from 'zod';

/**
 * Submission Status
 */
export enum SubmissionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  NEEDS_REVISION = 'needs_revision',
  FAILED = 'failed',
}

/**
 * Submission Entity
 */
export interface Submission {
  id: string;
  campaignId: string;
  creatorId: string;
  reelUrl: string;
  reelId: string | null; // Instagram reel ID
  caption: string | null;
  status: SubmissionStatus;
  submittedAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Submission Creation Input
 */
export const CreateSubmissionSchema = z.object({
  campaignId: z.string(),
  creatorId: z.string(),
  reelUrl: z.string().url(),
  reelId: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
});export type CreateSubmissionInput = z.infer<typeof CreateSubmissionSchema>;/**
 * Submission Update Input
 */
export const UpdateSubmissionSchema = z.object({
  status: z.nativeEnum(SubmissionStatus).optional(),
  caption: z.string().nullable().optional(),
});export type UpdateSubmissionInput = z.infer<typeof UpdateSubmissionSchema>;
