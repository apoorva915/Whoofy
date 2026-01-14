import { z } from 'zod';

/**
 * Creator Niche
 */
export enum CreatorNiche {
  TECH = 'Tech',
  FASHION = 'Fashion',
  FOOD = 'Food',
  TRAVEL = 'Travel',
  FITNESS = 'Fitness',
  BEAUTY = 'Beauty',
  GAMING = 'Gaming',
  EDUCATION = 'Education',
  ENTERTAINMENT = 'Entertainment',
  LIFESTYLE = 'Lifestyle',
  KIDS = 'Kids',
  OTHER = 'Other',
}

/**
 * Creator Gender
 */
export enum CreatorGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}/**
 * Creator Entity
 */
export interface Creator {
  id: string;
  instagramHandle: string;
  instagramId: string;
  displayName: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  niche: CreatorNiche[];
  gender: CreatorGender | null;
  age: number | null;
  location: string | null;
  language: string[]; // e.g., ['en', 'hi']
  profilePictureUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creator Creation Input
 */
export const CreateCreatorSchema = z.object({
  instagramHandle: z.string().min(1),
  instagramId: z.string().min(1),
  displayName: z.string().min(1),
  followerCount: z.number().default(0),
  followingCount: z.number().default(0),
  postCount: z.number().default(0),
  niche: z.array(z.nativeEnum(CreatorNiche)),
  gender: z.nativeEnum(CreatorGender).nullable().optional(),
  age: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  language: z.array(z.string()).default([]),
  profilePictureUrl: z.string().url().nullable().optional(),
  bio: z.string().nullable().optional(),
  isVerified: z.boolean().default(false),
});export type CreateCreatorInput = z.infer<typeof CreateCreatorSchema>;/**
 * Creator Update Input
 */
export const UpdateCreatorSchema = CreateCreatorSchema.partial();
export type UpdateCreatorInput = z.infer<typeof UpdateCreatorSchema>;
