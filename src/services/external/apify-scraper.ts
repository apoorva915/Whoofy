import axios, { AxiosInstance } from 'axios';
import { externalApiConfig, isApiConfigured } from '@/config/external-apis';
import { ExternalApiError, RateLimitError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Scraped Profile Data
 */
export interface ScrapedProfile {
  username: string;
  fullName: string | null;
  biography: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  profilePictureUrl: string | null;
  isVerified: boolean;
  isPrivate: boolean;
  externalUrl: string | null;
}

/**
 * Scraped Reel Data
 */
export interface ScrapedReel {
  id: string;
  shortcode: string;
  caption: string | null;
  likeCount: number;
  commentCount: number;
  playCount: number | null;
  timestamp: Date;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  comments: Array<{
    text: string;
    author: string;
    timestamp: Date;
  }>;
}

/**
 * Apify Scraper Client
 */
class ApifyScraperClient {
  private client: AxiosInstance;
  private apiToken: string | null;

  constructor() {
    this.apiToken = externalApiConfig.apify.apiToken || null;
    
    this.client = axios.create({
      baseURL: externalApiConfig.apify.baseUrl,
      timeout: 60000, // Longer timeout for scraping
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiToken && { Authorization: `Bearer ${this.apiToken}` }),
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          throw new RateLimitError('Apify', error.response.headers['retry-after']);
        }
        if (error.response) {
          throw new ExternalApiError(
            'Apify',
            error.response.data?.error?.message || error.message,
            error
          );
        }
        throw new ExternalApiError('Apify', error.message, error);
      }
    );
  }

  /**
   * Check if Apify is configured
   */
  isConfigured(): boolean {
    return isApiConfigured('apify');
  }

  /**
   * Scrape Instagram profile
   */
  async scrapeProfile(username: string): Promise<ScrapedProfile> {
    try {
      if (!this.isConfigured()) {
        logger.warn('Apify not configured, returning mock scraped data');
        return this.getMockProfile(username);
      }

      // Using Apify Instagram Scraper actor
      // Note: This is a simplified implementation
      // In production, you'd run an actor and wait for results
      const actorId = 'apify/instagram-scraper';
      
      // For now, return mock data
      // Real implementation would:
      // 1. Start actor run
      // 2. Wait for completion
      // 3. Fetch results
      
      logger.info(`Scraping profile for ${username} (mock mode)`);
      return this.getMockProfile(username);
    } catch (error) {
      logger.error({ error }, 'Error scraping profile:', error);
      return this.getMockProfile(username);
    }
  }

  /**
   * Scrape Instagram reel
   */
  async scrapeReel(reelUrl: string): Promise<ScrapedReel> {
    try {
      if (!this.isConfigured()) {
        logger.warn('Apify not configured, returning mock scraped data');
        return this.getMockReel(reelUrl);
      }

      const reelId = this.extractReelId(reelUrl);
      
      logger.info(`Scraping reel ${reelId} (mock mode)`);
      return this.getMockReel(reelUrl);
    } catch (error) {
      logger.error({ error }, 'Error scraping reel:', error);
      return this.getMockReel(reelUrl);
    }
  }

  /**
   * Extract reel ID from URL
   */
  private extractReelId(url: string): string {
    const match = url.match(/\/reel\/([A-Za-z0-9_-]+)/);
    if (match) {
      return match[1];
    }
    return url.split('/').pop() || 'unknown';
  }

  /**
   * Mock profile data
   */
  private getMockProfile(username: string): ScrapedProfile {
    return {
      username,
      fullName: `${username} Full Name`,
      biography: `Bio for ${username}`,
      followersCount: 15000,
      followingCount: 800,
      postsCount: 200,
      profilePictureUrl: null,
      isVerified: false,
      isPrivate: false,
      externalUrl: null,
    };
  }

  /**
   * Mock reel data
   */
  private getMockReel(reelUrl: string): ScrapedReel {
    const reelId = this.extractReelId(reelUrl);
    return {
      id: reelId,
      shortcode: reelId,
      caption: 'This is a mock reel caption with some text content.',
      likeCount: 2500,
      commentCount: 120,
      playCount: 15000,
      timestamp: new Date(),
      videoUrl: null,
      thumbnailUrl: null,
      comments: [
        {
          text: 'Great content!',
          author: 'user1',
          timestamp: new Date(),
        },
        {
          text: 'Love this!',
          author: 'user2',
          timestamp: new Date(),
        },
      ],
    };
  }
}

// Export singleton instance
export const apifyScraper = new ApifyScraperClient();
