import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Validate data against a Zod schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Validation failed', {
        errors: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      });
    }
    throw error;
  }
}

/**
 * Safe parse - returns result instead of throwing
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  return result;
}

/**
 * Validate URL
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Instagram Reel URL
 */
export function validateInstagramReelUrl(url: string): boolean {
  if (!validateUrl(url)) {
    return false;
  }
  
  const instagramReelPattern = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/reel\/[A-Za-z0-9_-]+/;
  return instagramReelPattern.test(url);
}

/**
 * Extract Instagram Reel ID from URL
 */
export function extractInstagramReelId(url: string): string | null {
  if (!validateInstagramReelUrl(url)) {
    return null;
  }
  
  const match = url.match(/\/reel\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Validate pagination params
 */
export function validatePagination(page?: number, limit?: number): {
  page: number;
  limit: number;
} {
  const validatedPage = Math.max(1, page || 1);
  const validatedLimit = Math.min(100, Math.max(1, limit || 20));
  
  return {
    page: validatedPage,
    limit: validatedLimit,
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}/**
 * Validate email (basic)
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}