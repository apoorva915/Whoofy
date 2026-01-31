/**
 * External API Services - Unified Export
 * 
 * This module provides a unified interface to all external API services.
 * All services have built-in fallback/mock support when APIs are not configured.
 */

// Export types only (Instagram API is deprecated, not exported)
export type { InstagramProfile, InstagramReelMetadata } from './instagram-api';
export { apifyScraper, type ScrapedProfile, type ScrapedReel } from './apify-scraper';
export { shazamApi, type ShazamTrack, type ShazamResult } from './shazam-api';

// Import types
import type { InstagramProfile, InstagramReelMetadata } from './instagram-api';
import type { ScrapedProfile, ScrapedReel } from './apify-scraper';
import type { ShazamResult } from './shazam-api';

// Import services (lazy to avoid circular dependencies and prevent Instagram API initialization)
import { apifyScraper } from './apify-scraper';
import { shazamApi } from './shazam-api';
import logger from '@/utils/logger';

/**
 * Unified External API Service
 * Provides a single interface to access all external APIs
 */
export class ExternalApiService {
  /**
   * Get Instagram profile data (uses Apify scraper only)
   */
  async getInstagramProfile(username: string): Promise<InstagramProfile> {
    // Use Apify scraper
    if (apifyScraper.isConfigured()) {
      try {
        const scraped = await apifyScraper.scrapeProfile(username);
        return {
          id: `scraped-${username}`,
          username: scraped.username,
          accountType: 'CREATOR',
          followersCount: scraped.followersCount,
          followingCount: scraped.followingCount,
          mediaCount: scraped.postsCount,
          profilePictureUrl: scraped.profilePictureUrl,
          bio: scraped.biography,
          website: scraped.externalUrl,
          isVerified: scraped.isVerified,
        };
      } catch (error: any) {
        const { logger } = await import('@/utils/logger');
        logger.error({ error: error.message }, 'Apify scraper failed');
        throw error;
      }
    }
    
    // If Apify not configured, throw error
    throw new Error('Apify scraper is not configured. Please set APIFY_API_TOKEN environment variable.');
  }

  /**
   * Get Instagram reel metadata (uses Apify scraper only)
   */
  async getInstagramReel(reelUrl: string): Promise<InstagramReelMetadata> {
    // Use Apify scraper
    if (apifyScraper.isConfigured()) {
      try {
        const scraped = await apifyScraper.scrapeReel(reelUrl);
        return {
          id: scraped.id,
          caption: scraped.caption,
          likeCount: scraped.likeCount,
          commentCount: scraped.commentCount,
          playCount: scraped.playCount,
          timestamp: scraped.timestamp,
          mediaType: 'REELS',
          videoUrl: scraped.videoUrl,
          thumbnailUrl: scraped.thumbnailUrl,
          permalink: `https://www.instagram.com/reel/${scraped.shortcode}/`,
        };
      } catch (error: any) {
        const { logger } = await import('@/utils/logger');
        logger.error({ error: error.message }, 'Apify scraper failed');
        throw error;
      }
    }
    
    // If Apify not configured, throw error
    throw new Error('Apify scraper is not configured. Please set APIFY_API_TOKEN environment variable.');
  }

  /**
   * Recognize audio/music in video
   */
  async recognizeAudio(videoUrl: string): Promise<ShazamResult> {
    return await shazamApi.recognizeFromVideo(videoUrl);
  }
}

// Export singleton instance
export const externalApiService = new ExternalApiService();
