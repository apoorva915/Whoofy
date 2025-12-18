import axios, { AxiosInstance } from 'axios';
import { externalApiConfig, isApiConfigured } from '@/config/external-apis';
import { ExternalApiError, RateLimitError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Instagram Profile Data
 */
export interface InstagramProfile {
  id: string;
  username: string;
  accountType: 'PERSONAL' | 'BUSINESS' | 'CREATOR';
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  profilePictureUrl: string | null;
  bio: string | null;
  website: string | null;
  isVerified: boolean;
}

/**
 * Instagram Reel Metadata
 */
export interface InstagramReelMetadata {
  id: string;
  caption: string | null;
  likeCount: number;
  commentCount: number;
  playCount: number | null;
  timestamp: Date;
  mediaType: 'REELS' | 'VIDEO';
  videoUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  ownerUsername?: string | null; // Owner/author username if available
}

/**
 * Instagram API Client (using RapidAPI - simple API key only)
 */
class InstagramApiClient {
  private client: AxiosInstance;
  private apiKey: string | null;

  constructor() {
    this.apiKey = externalApiConfig.instagram.apiKey || null;
    
    // instagram-scraper21 uses /api/v1/ prefix
    // baseUrl is already https://instagram-scraper21.p.rapidapi.com
    // So we need to add /api/v1
    const baseUrl = externalApiConfig.instagram.baseUrl;
    const apiBaseUrl = baseUrl.endsWith('/api/v1') 
      ? baseUrl 
      : baseUrl.endsWith('/api/v1/')
      ? baseUrl.slice(0, -1) // Remove trailing slash
      : `${baseUrl}/api/v1`;
    
    logger.debug(`Instagram API base URL: ${apiBaseUrl}`);
    
    this.client = axios.create({
      baseURL: apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': externalApiConfig.instagram.apiHost,
        }),
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          throw new RateLimitError('Instagram', error.response.headers['retry-after']);
        }
        if (error.response) {
          throw new ExternalApiError(
            'Instagram',
            error.response.data?.message || error.message,
            error
          );
        }
        throw new ExternalApiError('Instagram', error.message, error);
      }
    );
  }

  /**
   * Check if Instagram API is configured
   */
  isConfigured(): boolean {
    return isApiConfigured('instagram');
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
   * Get user profile by username
   */
  async getUserProfile(username: string): Promise<InstagramProfile> {
    try {
      if (!this.isConfigured()) {
        logger.warn('Instagram API not configured, returning mock data');
        return this.getMockProfile(username);
      }

      logger.info(`Fetching Instagram profile for: ${username}`);
      
      // Use RapidAPI Instagram scraper - correct endpoints from API documentation
      // instagram-scraper21 uses /api/v1/ prefix (already in baseURL)
      let response;
      const endpoints = [
        // Primary endpoint for user info
        { path: '/info', params: { id_or_username: username } },
        // Alternative: get user ID first, then info
        { path: '/user-id', params: { id_or_username: username } },
        // Fallback patterns
        { path: '/info', params: { username } },
        { path: '/info', params: { id: username } },
      ];
      
      let lastError: any = null;
      for (const endpoint of endpoints) {
        try {
          logger.debug(`Trying profile endpoint: ${endpoint.path} with params:`, endpoint.params);
          response = await this.client.get(endpoint.path, {
            params: endpoint.params,
          });
          logger.info(`Success with profile endpoint: ${endpoint.path}`);
          break; // Success, exit loop
        } catch (error: any) {
          lastError = error;
          // If it's not a 404/400, the endpoint might be correct but has other issues
          if (error.response?.status && error.response.status !== 404 && error.response.status !== 400) {
            logger.debug(`Profile endpoint ${endpoint.path} returned status ${error.response.status}, stopping search`);
            break;
          }
          continue; // Try next endpoint
        }
      }
      
      if (!response) {
        logger.error('All Instagram profile API endpoints failed. Last error:', lastError?.response?.status || lastError?.message);
        throw lastError || new Error('All Instagram API endpoints failed');
      }

      const data = response.data;
      
      // instagram-scraper21 returns: { status: 'ok', data: { user: {...} } }
      const profileData = data.data?.user || data.data || data.result || data;
      
      return {
        id: profileData.id || profileData.pk || `user-${username}`,
        username: profileData.username || profileData.user?.username || username,
        accountType: profileData.is_business_account 
          ? 'BUSINESS' 
          : profileData.is_verified 
          ? 'CREATOR' 
          : 'PERSONAL',
        followersCount: profileData.edge_followed_by?.count 
          || profileData.followers_count 
          || profileData.follower_count 
          || profileData.follower_count
          || 0,
        followingCount: profileData.edge_follow?.count 
          || profileData.following_count 
          || profileData.following_count
          || 0,
        mediaCount: profileData.edge_owner_to_timeline_media?.count 
          || profileData.media_count 
          || profileData.post_count
          || profileData.edge_owner_to_timeline_media?.count
          || 0,
        profilePictureUrl: profileData.profile_pic_url_hd 
          || profileData.profile_pic_url 
          || profileData.profile_picture_url
          || profileData.profile_picture 
          || null,
        bio: profileData.biography 
          || profileData.bio 
          || profileData.user?.biography
          || null,
        website: profileData.external_url 
          || profileData.website 
          || profileData.external_links?.[0]?.url
          || null,
        isVerified: profileData.is_verified 
          || profileData.is_verified_account
          || false,
      };
    } catch (error: any) {
      logger.error({ error }, 'Error fetching Instagram profile:', {
        username,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers ? Object.keys(error.config.headers) : undefined,
        },
      });
      
      // If API is configured but failed, throw error instead of returning mock
      if (this.isConfigured()) {
        throw new ExternalApiError(
          'Instagram',
          `Failed to fetch profile: ${error.response?.status || error.message}`,
          error
        );
      }
      
      // Only return mock if API is not configured
      return this.getMockProfile(username);
    }
  }

  /**
   * Get reel metadata by reel ID or URL
   */
  async getReelMetadata(reelIdOrUrl: string): Promise<InstagramReelMetadata> {
    try {
      const reelId = this.extractReelId(reelIdOrUrl);
      
      if (!this.isConfigured()) {
        logger.warn('Instagram API not configured, returning mock data');
        return this.getMockReelMetadata(reelId);
      }

      logger.info(`Fetching Instagram reel metadata for: ${reelIdOrUrl}`);
      
      // Use RapidAPI Instagram scraper - correct endpoints from API documentation
      // instagram-scraper21 uses /api/v1/ prefix (already in baseURL)
      // The reel ID (shortcode) is the "code" parameter
      let response;
      const endpoints = [
        // Primary endpoint for post/reel info - uses "code" parameter
        { path: '/post-info', params: { code: reelId } },
        // Alternative: try with id_or_username
        { path: '/post-info', params: { id_or_username: reelId } },
        // Alternative endpoints
        { path: '/full-posts', params: { id_or_username: reelId, limit: '1' } },
        { path: '/reels', params: { id_or_username: reelId, limit: '1' } },
      ];
      
      let lastError: any = null;
      for (const endpoint of endpoints) {
        try {
          logger.debug(`Trying endpoint: ${endpoint.path} with params:`, endpoint.params);
          response = await this.client.get(endpoint.path, {
            params: endpoint.params,
          });
          logger.info(`Success with endpoint: ${endpoint.path}`);
          break; // Success, exit loop
        } catch (error: any) {
          lastError = error;
          // If it's not a 404/400, the endpoint might be correct but has other issues
          if (error.response?.status && error.response.status !== 404 && error.response.status !== 400) {
            logger.debug(`Endpoint ${endpoint.path} returned status ${error.response.status}, stopping search`);
            break;
          }
          continue; // Try next endpoint
        }
      }
      
      if (!response) {
        logger.error('All Instagram API endpoints failed. Last error:', lastError?.response?.status || lastError?.message);
        throw lastError || new Error('All Instagram API endpoints failed');
      }

      const data = response.data;
      // instagram-scraper21 returns: { status: 'ok', data: { post: {...} } }
      const reelData = data.data?.post || data.data || data.result || data;
      
      // Extract owner/username from various possible locations
      const ownerUsername = reelData.owner?.username 
        || reelData.user?.username 
        || reelData.author?.username
        || reelData.owner_username
        || reelData.username
        || null;
      
      // Extract video URL from various possible locations
      const videoInfo = reelData.video_url 
        || reelData.video_versions?.[0]?.url 
        || reelData.video_versions?.[0]?.src
        || reelData.media_url 
        || reelData.display_url
        || null;
      
      // Extract caption from various formats
      const caption = reelData.caption?.text 
        || reelData.edge_media_to_caption?.edges?.[0]?.node?.text 
        || reelData.caption 
        || reelData.text
        || null;
      
      // Extract like count
      const likeCount = reelData.edge_media_preview_like?.count 
        || reelData.likes_count 
        || reelData.like_count 
        || reelData.edge_liked_by?.count
        || 0;
      
      // Extract comment count
      const commentCount = reelData.edge_media_to_comment?.count 
        || reelData.comments_count 
        || reelData.comment_count
        || reelData.edge_media_to_comment?.count
        || 0;
      
      // Extract play/view count
      const playCount = reelData.video_view_count 
        || reelData.play_count 
        || reelData.view_count
        || reelData.video_play_count
        || null;
      
      // Extract timestamp
      const timestamp = reelData.taken_at_timestamp 
        ? new Date(reelData.taken_at_timestamp * 1000)
        : reelData.timestamp
        ? new Date(reelData.timestamp * 1000)
        : reelData.created_at
        ? new Date(reelData.created_at * 1000)
        : new Date();
      
      // Build permalink - include username if available
      const permalink = ownerUsername
        ? `https://www.instagram.com/${ownerUsername}/reel/${reelData.shortcode || reelId}/`
        : reelData.permalink || `https://www.instagram.com/reel/${reelData.shortcode || reelId}/`;
      
      return {
        id: reelData.id || reelData.shortcode || reelId,
        caption,
        likeCount,
        commentCount,
        playCount,
        timestamp,
        mediaType: reelData.__typename?.includes('Video') || reelData.is_video || reelData.type === 'video' ? 'REELS' : 'VIDEO',
        videoUrl: videoInfo,
        thumbnailUrl: reelData.thumbnail_src || reelData.display_url || reelData.thumbnail_url || reelData.thumbnail || null,
        permalink,
        // Add owner username to metadata for easier access
        ownerUsername,
      };
    } catch (error: any) {
      // Only log error but don't return mock if API is configured - let caller handle it
      logger.error({ error }, 'Error fetching Instagram reel metadata:', {
        reelIdOrUrl,
        reelId: this.extractReelId(reelIdOrUrl),
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
        },
      });
      
      // If API is configured but failed, throw error instead of returning mock
      if (this.isConfigured()) {
        throw new ExternalApiError(
          'Instagram',
          `Failed to fetch reel metadata: ${error.response?.status || error.message}`,
          error
        );
      }
      
      // Only return mock if API is not configured
      const reelId = this.extractReelId(reelIdOrUrl);
      return this.getMockReelMetadata(reelId);
    }
  }

  /**
   * Get user's media (posts/reels)
   */
  async getUserMedia(usernameOrId: string, limit: number = 25): Promise<InstagramReelMetadata[]> {
    try {
      if (!this.isConfigured()) {
        logger.warn('Instagram API not configured, returning mock data');
        return [this.getMockReelMetadata('mock-reel-1')];
      }

      const profile = await this.getUserProfile(usernameOrId);
      const response = await this.client.get('/user/posts', {
        params: {
          username_or_id: usernameOrId,
          limit,
        },
      });

      const items = response.data.items || response.data.data || [];
      return items.map((item: any) => ({
        id: item.id,
        caption: item.caption?.text || null,
        likeCount: item.like_count || 0,
        commentCount: item.comment_count || 0,
        playCount: item.play_count || null,
        timestamp: item.taken_at ? new Date(item.taken_at * 1000) : new Date(),
        mediaType: item.is_video ? 'REELS' : 'VIDEO',
        videoUrl: item.video_url || null,
        thumbnailUrl: item.thumbnail_url || null,
        permalink: item.permalink || `https://www.instagram.com/reel/${item.id}/`,
      }));
    } catch (error) {
      logger.error({ error }, 'Error fetching user media:', error);
      return [this.getMockReelMetadata('mock-reel-1')];
    }
  }

  /**
   * Mock profile data (fallback when API not configured)
   */
  private getMockProfile(usernameOrId: string): InstagramProfile {
    return {
      id: `mock-${usernameOrId}`,
      username: usernameOrId.replace('mock-', ''),
      accountType: 'CREATOR',
      followersCount: 10000,
      followingCount: 500,
      mediaCount: 150,
      profilePictureUrl: null,
      bio: 'Mock Instagram profile',
      website: null,
      isVerified: false,
    };
  }

  /**
   * Mock reel metadata (fallback when API not configured)
   */
  private getMockReelMetadata(reelId: string): InstagramReelMetadata {
    return {
      id: reelId,
      caption: 'Mock reel caption',
      likeCount: 1000,
      commentCount: 50,
      playCount: 5000,
      timestamp: new Date(),
      mediaType: 'REELS',
      videoUrl: null,
      thumbnailUrl: null,
      permalink: `https://www.instagram.com/reel/${reelId}/`,
    };
  }
}

// Export singleton instance
export const instagramApi = new InstagramApiClient();
