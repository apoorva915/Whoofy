import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Environment Variables Schema
 */
const EnvSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis (for BullMQ)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // External APIs - Instagram (via RapidAPI - simpler alternative)
  INSTAGRAM_RAPIDAPI_KEY: z.string().optional(),
  INSTAGRAM_RAPIDAPI_HOST: z.string().default('instagram-scraper-api2.p.rapidapi.com'),
  
  // External APIs - Apify
  APIFY_API_TOKEN: z.string().optional(),
  
  // External APIs - Shazam
  SHAZAM_API_KEY: z.string().optional(),
  SHAZAM_API_HOST: z.string().default('shazam-api7.p.rapidapi.com'),
  
  // External APIs - NoteGPT
  NOTEGPT_API_KEY: z.string().optional(),
  NOTEGPT_API_URL: z.string().url().optional(),
  
  // AI Services - OpenAI
  OPENAI_API_KEY: z.string().optional(),
  
  // AI Services - Google Gemini
  GEMINI_API_KEY: z.string().optional(),
  
  // AI Services - Google Cloud (alternative)
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_VISION_API_KEY: z.string().optional(),
  
  // Storage
  STORAGE_TYPE: z.enum(['local', 's3', 'cloudinary']).default('local'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  
  // Application
  PORT: z.string().transform(Number).default('3000'),
  API_BASE_URL: z.string().url().optional(),
  
  // Security
  JWT_SECRET: z.string().optional(),
  API_KEY: z.string().optional(),
});

/**
 * Validated Environment Variables
 */
export type Env = z.infer<typeof EnvSchema>;

let env: Env;

try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    throw new Error('Environment validation failed');
  }
  throw error;
}

export default env;
