import { z } from 'zod';

/**
 * Campaign Requirements Schema
 */
export const CampaignRequirementsSchema = z.object({
  minFollowers: z.number().optional(),
  niche: z.array(z.string()).optional(), // e.g., ['Tech', 'Fashion', 'Food']
  gender: z.enum(['male', 'female', 'any']).optional(),
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  languages: z.array(z.string()).optional(), // e.g., ['en', 'hi', 'bn']
  locations: z.array(z.string()).optional(), // e.g., ['Mumbai', 'Delhi', 'Bengaluru']
  requiredHashtags: z.array(z.string()).optional(),
  requiredKeywords: z.array(z.string()).optional(),
  requiredMentions: z.array(z.string()).optional(),
  contentFormat: z.enum(['UGC', 'Tutorial', 'Testimonial', 'Unboxing', 'Any']).optional(),
  script: z.string().optional(), // Brand-provided script
  additionalInstructions: z.string().optional(),
});

export type CampaignRequirements = z.infer<typeof CampaignRequirementsSchema>;

/**
 * Campaign Status
 */
export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

/**
 * Campaign Entity
 */
export interface Campaign {
  id: string;
  brandId: string;
  brandName: string;
  title: string;
  description: string;
  requirements: CampaignRequirements;
  status: CampaignStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}/**
 * Campaign Creation Input
 */
export const CreateCampaignSchema = z.object({
  brandId: z.string(),
  brandName: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  requirements: CampaignRequirementsSchema,
  startDate: z.date().or(z.string().datetime()),
  endDate: z.date().or(z.string().datetime()),
});export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;/**
 * Campaign Update Input
 */
export const UpdateCampaignSchema = CreateCampaignSchema.partial();
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
