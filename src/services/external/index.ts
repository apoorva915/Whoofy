/**
 * External API Services - Unified Export
 * 
 * This module provides a unified interface to all external API services.
 * All services have built-in fallback/mock support when APIs are not configured.
 */

export { instagramApi, type InstagramProfile, type InstagramReelMetadata } from './instagram-api';
export { apifyScraper, type ScrapedProfile, type ScrapedReel } from './apify-scraper';
export { shazamApi, type ShazamTrack, type ShazamResult } from './shazam-api';
export { notegptApi } from './notegpt-api';
// Export transcription types from openai-whisper (same types as notegpt-api)
export { openaiWhisper, type TranscriptionSegment, type TranscriptionResult } from './openai-whisper';

// Import types
import type { InstagramProfile, InstagramReelMetadata } from './instagram-api';
import type { ScrapedProfile, ScrapedReel } from './apify-scraper';
import type { TranscriptionResult } from './openai-whisper';
import type { ShazamResult } from './shazam-api';

// Import services (lazy to avoid circular dependencies)
import { instagramApi } from './instagram-api';
import { apifyScraper } from './apify-scraper';
import { notegptApi } from './notegpt-api';
import { shazamApi } from './shazam-api';
import logger from '@/utils/logger';

/**
 * Unified External API Service
 * Provides a single interface to access all external APIs
 */
export class ExternalApiService {
  /**
   * Get Instagram profile data (tries official API first, falls back to scraping)
   */
  async getInstagramProfile(username: string): Promise<InstagramProfile> {
      // Try official API first
      if (instagramApi.isConfigured()) {
      try {
        return await instagramApi.getUserProfile(username);
      } catch (error: any) {
        // Log the error but try fallback
        const { logger } = await import('@/utils/logger');
        logger.warn({ error: error.message }, 'Instagram API failed, trying Apify fallback');
        // Continue to fallback below
      }
    }
    
    // Use scraper as fallback
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
        logger.warn({ error: error.message }, 'Apify scraper failed, using mock data');
      }
    }
    
    // Last resort: return mock data
    const { logger } = await import('@/utils/logger');
    logger.warn('All Instagram APIs failed, returning mock data');
    return instagramApi.getUserProfile(username); // This will return mock since API failed
  }

  /**
   * Get Instagram reel metadata (tries official API first, falls back to scraping)
   */
  async getInstagramReel(reelUrl: string): Promise<InstagramReelMetadata> {
      // Try official API first
      if (instagramApi.isConfigured()) {
      try {
        return await instagramApi.getReelMetadata(reelUrl);
      } catch (error: any) {
        // Log the error but try fallback
        const { logger } = await import('@/utils/logger');
        logger.warn({ error: error.message }, 'Instagram API failed, trying Apify fallback');
        // Continue to fallback below
      }
    }
    
    // Use scraper as fallback
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
        logger.warn({ error: error.message }, 'Apify scraper failed, using mock data');
      }
    }
    
    // Last resort: return mock data
    const { logger } = await import('@/utils/logger');
    logger.warn('All Instagram APIs failed, returning mock data');
    return instagramApi.getReelMetadata(reelUrl); // This will return mock since API failed
  }

  /**
   * Transcribe video/audio
   * Uses OpenAI Whisper API (NoteGPT removed - endpoint doesn't exist)
   */
  async transcribeVideo(videoUrl: string): Promise<TranscriptionResult> {
    logger.info(`Starting transcription for: ${videoUrl}`);
    
    try {
      // Use OpenAI Whisper (the only working transcription API)
      const { openaiWhisper } = await import('./openai-whisper');
      if (!openaiWhisper.isConfigured()) {
        logger.warn('OpenAI Whisper API not configured. Please set OPENAI_API_KEY in your .env file.');
        return {
          transcript: '',
          language: 'unknown',
          segments: [],
          processingTimeMs: 0,
        };
      }
      
      logger.info('Using OpenAI Whisper for transcription (auto-detect language, supports Hindi)');
      const result = await openaiWhisper.transcribeFromUrl(videoUrl, {
        includeTimestamps: true,
        // Let Whisper auto-detect language (supports Hindi and many others)
        language: undefined,
      });
      
      logger.info(`Transcription successful: ${result.transcript.length} characters, language: ${result.language}, ${result.segments.length} segments`);
      return result;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || error?.response?.status;
      
      logger.error({
        error: errorMsg,
        code: errorCode,
        videoUrl: videoUrl.substring(0, 100),
        stack: error?.stack?.substring(0, 500), // Limit stack trace
      }, 'Transcription failed');
      
      // Return empty transcription on error
      return {
        transcript: '',
        language: 'unknown',
        segments: [],
        processingTimeMs: 0,
      };
    }
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
