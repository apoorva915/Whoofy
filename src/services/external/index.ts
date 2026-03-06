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
import { instaloaderMl } from './instaloader-ml';

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
   * Get Instagram profile data
   * Tries Instaloader (via ML service) first, then falls back to Apify scraper.
   */
  async getInstagramProfile(username: string): Promise<InstagramProfile> {
    // Primary: Instaloader via ML service
    if (instaloaderMl.isConfigured()) {
      try {
        const profile = await instaloaderMl.fetchProfile(username);
        return {
          id: profile.profile_id || `instaloader-${profile.username}`,
          username: profile.username,
          accountType: profile.is_verified ? 'CREATOR' : 'PERSONAL',
          followersCount: profile.followers_count,
          followingCount: profile.following_count,
          mediaCount: profile.posts_count,
          profilePictureUrl: profile.profile_picture_url,
          bio: profile.biography,
          website: profile.external_url,
          isVerified: profile.is_verified,
        };
      } catch (error: any) {
        logger.warn(
          { error: error.message, username },
          'Instaloader ML profile fetch failed, falling back to Apify scraper',
        );
      }
    }

    // Fallback: Apify scraper
    if (apifyScraper.isConfigured()) {
      try {
        const scraped = await apifyScraper.scrapeProfile(username);
        return {
          id: scraped.profileId || `scraped-${username}`,
          username: scraped.username,
          accountType: scraped.isBusinessAccount ? 'BUSINESS' : 'CREATOR',
          followersCount: scraped.followersCount,
          followingCount: scraped.followingCount,
          mediaCount: scraped.postsCount,
          profilePictureUrl: scraped.profilePictureUrl,
          bio: scraped.biography,
          website: scraped.externalUrl,
          isVerified: scraped.isVerified,
        };
      } catch (error: any) {
        logger.error({ error: error.message, username }, 'Apify scraper failed for profile');
        throw error;
      }
    }

    throw new Error(
      'Neither Instaloader ML service (ML_SERVICE_URL) nor Apify scraper (APIFY_API_TOKEN) are configured for Instagram profiles.',
    );
  }

  /**
   * Get Instagram reel metadata
   * Tries Instaloader (via ML service) first, then falls back to Apify scraper.
   */
  async getInstagramReel(reelUrl: string): Promise<InstagramReelMetadata> {
    // Primary: Instaloader via ML service
    if (instaloaderMl.isConfigured()) {
      try {
        const reel = await instaloaderMl.fetchReel(reelUrl);
        return {
          id: reel.id,
          caption: reel.caption,
          likeCount: reel.like_count,
          commentCount: reel.comment_count,
          playCount: reel.play_count,
          timestamp: new Date(reel.timestamp),
          mediaType: 'REELS',
          videoUrl: reel.video_url,
          thumbnailUrl: reel.thumbnail_url,
          permalink: reel.url || `https://www.instagram.com/reel/${reel.shortcode}/`,
        };
      } catch (error: any) {
        logger.warn(
          { error: error.message, reelUrl },
          'Instaloader ML reel fetch failed, falling back to Apify scraper',
        );
      }
    }

    // Fallback: Apify scraper
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
        logger.error({ error: error.message, reelUrl }, 'Apify scraper failed for reel');
        throw error;
      }
    }

    throw new Error(
      'Neither Instaloader ML service (ML_SERVICE_URL) nor Apify scraper (APIFY_API_TOKEN) are configured for Instagram reels.',
    );
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
