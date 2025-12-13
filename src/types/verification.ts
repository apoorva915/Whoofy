import { z } from 'zod';

/**
 * Verification Status
 */
export enum VerificationStatus {
  APPROVED = 'approved',
  NEEDS_REVISION = 'needs_revision',
  REJECTED = 'rejected',
}

/**
 * Sentiment
 */
export enum Sentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
}

/**
 * Detected Object
 */
export interface DetectedObject {
  name: string;
  confidence: number; // 0-1
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Detected Brand
 */
export interface DetectedBrand {
  name: string;
  confidence: number; // 0-1
  source: 'logo' | 'product' | 'text' | 'audio';
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Brand Mention
 */
export interface BrandMention {
  brandName: string;
  source: 'caption' | 'audio' | 'text_on_screen';
  context: string; // Surrounding text
  timestamp?: number; // For audio mentions
}

/**
 * Creator Eligibility Check Result
 */
export interface CreatorEligibilityResult {
  passed: boolean;
  checks: {
    followerThreshold: { passed: boolean; actual: number; required?: number };
    nicheMatch: { passed: boolean; required?: string[]; actual: string[] };
    gender: { passed: boolean; required?: string; actual?: string };
    age: { passed: boolean; required?: { min?: number; max?: number }; actual?: number };
    language: { passed: boolean; required?: string[]; actual: string[] };
    location: { passed: boolean; required?: string[]; actual?: string };
  };
}

/**
 * Content Authenticity Check Result
 */
export interface ContentAuthenticityResult {
  passed: boolean;
  checks: {
    isOriginal: boolean;
    isNotReused: boolean;
    engagementAuthentic: boolean; // No fake views/engagement
    promotionTimestamp: Date | null;
  };
}

/**
 * Brand Integration Check Result
 */
export interface BrandIntegrationResult {
  passed: boolean;
  checks: {
    productVisible: boolean;
    brandMentioned: boolean;
    mentions: BrandMention[];
    sentiment: Sentiment;
    sentimentScore: number; // -1 to 1
    noCompetitorPromotion: boolean;
    noMisleadingClaims: boolean;
  };
}

/**
 * Campaign Rules Check Result
 */
export interface CampaignRulesResult {
  passed: boolean;
  checks: {
    scriptCompliance: { passed: boolean; score: number }; // If script provided
    mandatoryHashtags: { passed: boolean; found: string[]; missing: string[] };
    mandatoryKeywords: { passed: boolean; found: string[]; missing: string[] };
    mandatoryMentions: { passed: boolean; found: string[]; missing: string[] };
    contentFormat: { passed: boolean; required?: string; actual?: string };
    additionalInstructions: { passed: boolean; details: string };
  };
}

/**
 * Detection Results
 */
export interface DetectionResults {
  objects: DetectedObject[];
  brands: DetectedBrand[];
  text: string[]; // All text found (OCR + captions)
  transcript: string | null; // Speech-to-text transcript
  sentiment: Sentiment;
  sentimentScore: number;
  language: string;
}

/**
 * Verification Result Entity
 */
export interface VerificationResult {
  id: string;
  submissionId: string;
  status: VerificationStatus;
  overallScore: number; // 0-100
  
  // Detection results
  detectionResults: DetectionResults;
  
  // Verification checks
  creatorEligibility: CreatorEligibilityResult;
  contentAuthenticity: ContentAuthenticityResult;
  brandIntegration: BrandIntegrationResult;
  campaignRules: CampaignRulesResult;
  
  // Metadata
  processingTimeMs: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Verification Result Creation Input
 */
export const CreateVerificationResultSchema = z.object({
  submissionId: z.string(),
  status: z.nativeEnum(VerificationStatus),
  overallScore: z.number().min(0).max(100),
  detectionResults: z.any(), // Complex object, validate separately
  creatorEligibility: z.any(),
  contentAuthenticity: z.any(),
  brandIntegration: z.any(),
  campaignRules: z.any(),
  processingTimeMs: z.number(),
  errorMessage: z.string().nullable().optional(),
});

export type CreateVerificationResultInput = z.infer<typeof CreateVerificationResultSchema>;
