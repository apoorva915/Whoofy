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
 * Normalizes URLs by adding https:// if missing
 */
export function validateInstagramReelUrl(url: string): boolean {
  // Normalize URL - add https:// if missing
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  
  if (!validateUrl(normalizedUrl)) {
    return false;
  }
  
  const instagramReelPattern = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel)\/[A-Za-z0-9_-]+/;
  return instagramReelPattern.test(normalizedUrl);
}

/**
 * Normalize reel URL to a canonical form for storage and comparison.
 * Strips query string, hash, and trailing slash so that
 * https://instagram.com/reel/DRZN4egihHx/?hl=en and https://instagram.com/reel/DRZN4egihHx match.
 * Returns empty string for null/undefined/blank input so callers never pass null to DB.
 */
export function normalizeReelUrlCanonical(url: string | null | undefined): string {
  if (url == null || typeof url !== 'string' || !url.trim()) return '';
  let u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `https://${u}`;
  }
  try {
    const parsed = new URL(u);
    let path = parsed.pathname.replace(/\/+$/, '') || '/';
    let host = parsed.host.toLowerCase();
    if (host === 'www.instagram.com') host = 'instagram.com';
    if (host === 'www.instagr.am') host = 'instagr.am';
    return `${parsed.protocol}//${host}${path}`;
  } catch {
    return u;
  }
}

/**
 * Extract Instagram Reel ID from URL
 */
export function extractInstagramReelId(url: string): string | null {
  // Normalize URL first
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  
  if (!validateInstagramReelUrl(normalizedUrl)) {
    return null;
  }
  
  const match = normalizedUrl.match(/\/reel\/([A-Za-z0-9_-]+)/);
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