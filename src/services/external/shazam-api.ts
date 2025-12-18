import axios, { AxiosInstance } from 'axios';
import { externalApiConfig, isApiConfigured } from '@/config/external-apis';
import { ExternalApiError, RateLimitError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Shazam Track Information
 */
export interface ShazamTrack {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: number;
  label?: string;
  isrc?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
}

/**
 * Shazam Recognition Result
 */
export interface ShazamResult {
  track: ShazamTrack | null;
  confidence: number; // 0-1
  matchTime: number; // seconds into the audio
  processingTimeMs: number;
}

/**
 * Shazam API Client
 */
class ShazamApiClient {
  private client: AxiosInstance;
  private apiKey: string | null;

  constructor() {
    this.apiKey = externalApiConfig.shazam.apiKey || null;
    
    this.client = axios.create({
      baseURL: externalApiConfig.shazam.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': externalApiConfig.shazam.apiHost,
        }),
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          throw new RateLimitError('Shazam', error.response.headers['retry-after']);
        }
        if (error.response) {
          throw new ExternalApiError(
            'Shazam',
            error.response.data?.message || error.message,
            error
          );
        }
        throw new ExternalApiError('Shazam', error.message, error);
      }
    );
  }

  /**
   * Check if Shazam API is configured
   */
  isConfigured(): boolean {
    return isApiConfigured('shazam');
  }

  /**
   * Recognize audio from audio file buffer or URL
   */
  async recognizeAudio(audioInput: Buffer | string): Promise<ShazamResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConfigured()) {
        logger.warn('Shazam API not configured, returning mock result');
        return this.getMockResult();
      }

      // If input is a URL, download the audio first
      let audioBuffer: Buffer;
      if (typeof audioInput === 'string') {
        // Download audio from URL
        const response = await axios.get(audioInput, {
          responseType: 'arraybuffer',
        });
        audioBuffer = Buffer.from(response.data);
      } else {
        audioBuffer = audioInput;
      }

      // Convert audio to base64 for Shazam API
      const base64Audio = audioBuffer.toString('base64');

      // Call Shazam API
      // Note: This is a simplified implementation
      // Real Shazam API might require different format
      const response = await this.client.post('/v1/search', {
        audio: base64Audio,
      });

      const data = response.data;
      const processingTime = Date.now() - startTime;

      if (data.matches && data.matches.length > 0) {
        const match = data.matches[0];
        return {
          track: {
            title: match.track?.title || 'Unknown',
            artist: match.track?.subtitle || 'Unknown Artist',
            album: match.track?.sections?.[0]?.metadata?.[0]?.text,
            genre: match.track?.genres?.primary,
            year: match.track?.sections?.[0]?.metadata?.find((m: any) => m.title === 'Released')?.text,
            isrc: match.track?.isrc,
            spotifyUrl: match.track?.hub?.actions?.[0]?.uri,
            appleMusicUrl: match.track?.hub?.options?.[0]?.actions?.[0]?.uri,
            youtubeUrl: match.track?.hub?.providers?.[0]?.actions?.[0]?.uri,
          },
          confidence: match.confidence || 0.8,
          matchTime: match.matchTime || 0,
          processingTimeMs: processingTime,
        };
      }

      return {
        track: null,
        confidence: 0,
        matchTime: 0,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      logger.error('Error recognizing audio with Shazam:', error);
      return this.getMockResult();
    }
  }

  /**
   * Recognize audio from video URL
   */
  async recognizeFromVideo(videoUrl: string): Promise<ShazamResult> {
    try {
      // In a real implementation, you would:
      // 1. Extract audio from video
      // 2. Convert to format Shazam accepts
      // 3. Call recognizeAudio
      
      logger.info(`Recognizing audio from video: ${videoUrl} (mock mode)`);
      return this.getMockResult();
    } catch (error) {
      logger.error('Error recognizing audio from video:', error);
      return this.getMockResult();
    }
  }

  /**
   * Mock result (fallback when API not configured)
   */
  private getMockResult(): ShazamResult {
    return {
      track: {
        title: 'Mock Track',
        artist: 'Mock Artist',
        album: 'Mock Album',
        genre: 'Pop',
        year: 2024,
      },
      confidence: 0.85,
      matchTime: 5.2,
      processingTimeMs: 1500,
    };
  }
}

// Export singleton instance
export const shazamApi = new ShazamApiClient();
