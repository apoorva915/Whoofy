import env from '@/config/env';
import logger from '@/utils/logger';

interface InstaloaderComment {
  id?: string;
  text: string;
  owner_username: string;
  timestamp: string;
  likes_count?: number;
}

export interface InstaloaderReel {
  id: string;
  shortcode: string;
  url: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  play_count: number | null;
  timestamp: string;
  video_url: string | null;
  thumbnail_url: string | null;
  owner_username: string | null;
  owner_full_name: string | null;
  hashtags: string[];
  mentions: string[];
  comments: InstaloaderComment[];
}

interface InstaloaderProfilePost {
  id: string;
  url: string;
  caption: string | null;
  likes: number;
  comments: number;
  timestamp: string;
  type: string;
}

export interface InstaloaderProfile {
  username: string;
  full_name: string | null;
  biography: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  profile_picture_url: string | null;
  is_verified: boolean;
  is_private: boolean;
  external_url: string | null;
  profile_id: string | null;
  profile_url: string | null;
  business_category: string | null;
  latest_posts: InstaloaderProfilePost[];
}

class InstaloaderMlClient {
  private baseUrl?: string;

  constructor() {
    this.baseUrl = env.ML_SERVICE_URL?.replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  private async postJson<TResponse>(endpoint: string, body: Record<string, any>): Promise<TResponse> {
    if (!this.baseUrl) {
      throw new Error('ML service URL (ML_SERVICE_URL) is not configured');
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      logger.error({ url, status: res.status, textPreview: text.slice(0, 300) }, 'Instaloader ML service returned non-JSON response');
      throw new Error(`Instaloader ML service returned non-JSON response (${res.status})`);
    }

    if (!res.ok) {
      const message = parsed?.detail || parsed?.error || `Instaloader ML service error (${res.status})`;
      throw new Error(message);
    }

    if (parsed?.error) {
      throw new Error(parsed.error);
    }

    return parsed as TResponse;
  }

  async fetchReel(reelUrl: string): Promise<InstaloaderReel> {
    logger.info({ reelUrl }, 'Calling ML Instaloader reel endpoint');
    return await this.postJson<InstaloaderReel>('/instagram/reel', { reel_url: reelUrl });
  }

  async fetchProfile(username: string): Promise<InstaloaderProfile> {
    logger.info({ username }, 'Calling ML Instaloader profile endpoint');
    return await this.postJson<InstaloaderProfile>('/instagram/profile', { username });
  }
}

export const instaloaderMl = new InstaloaderMlClient();

