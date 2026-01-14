/**
 * Application Constants
 */

/**
 * Submission Statuses
 */
export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  NEEDS_REVISION: 'needs_revision',
  FAILED: 'failed',
} as const;

/**
 * Verification Statuses
 */
export const VERIFICATION_STATUS = {
  APPROVED: 'approved',
  NEEDS_REVISION: 'needs_revision',
  REJECTED: 'rejected',
} as const;

/**
 * Campaign Statuses
 */
export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

/**
 * Sentiment Types
 */
export const SENTIMENT = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative',
} as const;

/**
 * Content Formats
 */
export const CONTENT_FORMAT = {
  UGC: 'UGC',
  TUTORIAL: 'Tutorial',
  TESTIMONIAL: 'Testimonial',
  UNBOXING: 'Unboxing',
  ANY: 'Any',
} as const;

/**
 * Error Codes
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
} as const;

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Pagination Defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Verification Scoring Weights
 */
export const VERIFICATION_WEIGHTS = {
  CREATOR_ELIGIBILITY: 0.25,
  CONTENT_AUTHENTICITY: 0.25,
  BRAND_INTEGRATION: 0.30,
  CAMPAIGN_RULES: 0.20,
} as const;

/**
 * Processing Timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  VIDEO_DOWNLOAD: 300000, // 5 minutes
  VIDEO_PROCESSING: 600000, // 10 minutes
  AI_DETECTION: 120000, // 2 minutes
  EXTERNAL_API: 30000, // 30 seconds
} as const;/**
 * File Size Limits (in bytes)
 */
export const FILE_LIMITS = {
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10 MB
} as const;/**
 * Supported Video Formats
 */
export const VIDEO_FORMATS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'] as const;/**
 * Supported Image Formats
 */
export const IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
