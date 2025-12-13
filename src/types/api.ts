import { z } from 'zod';
import { SubmissionStatus, VerificationStatus } from './verification';

/**
 * API Response Wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * Pagination Params
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Verify Reel Request
 */
export const VerifyReelRequestSchema = z.object({
  submissionId: z.string().optional(),
  reelUrl: z.string().url(),
  campaignId: z.string(),
  creatorId: z.string(),
});

export type VerifyReelRequest = z.infer<typeof VerifyReelRequestSchema>;

/**
 * Verify Reel Response
 */
export interface VerifyReelResponse {
  verificationId: string;
  submissionId: string;
  status: 'processing' | 'completed' | 'failed';
  message: string;
}

/**
 * Get Verification Status Response
 */
export interface GetVerificationStatusResponse {
  verificationId: string;
  submissionId: string;
  status: SubmissionStatus;
  verificationStatus: VerificationStatus | null;
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
  result?: any; // VerificationResult if completed
}

/**
 * Health Check Response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    externalApis: {
      instagram: 'up' | 'down';
      apify: 'up' | 'down';
      shazam: 'up' | 'down';
      notegpt: 'up' | 'down';
    };
  };
  timestamp: string;
}
