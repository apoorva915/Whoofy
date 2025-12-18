import axios, { AxiosInstance } from 'axios';
import { externalApiConfig, isApiConfigured } from '@/config/external-apis';
import { ExternalApiError, RateLimitError } from '@/utils/errors';
import logger from '@/utils/logger';
import path from 'path';
import fs from 'fs-extra';
import { audioExtractor } from '@/services/video/audio-extractor';

/**
 * Transcription Segment
 */
export interface TranscriptionSegment {
  text: string;
  start: number; // seconds
  end: number; // seconds
  confidence: number; // 0-1
}

/**
 * Transcription Result
 */
export interface TranscriptionResult {
  transcript: string;
  language: string;
  segments: TranscriptionSegment[];
  processingTimeMs: number;
}

/**
 * NoteGPT API Client
 */
class NoteGPTApiClient {
  private client: AxiosInstance;
  private apiKey: string | null;

  constructor() {
    this.apiKey = externalApiConfig.notegpt.apiKey || null;
    const baseUrl = externalApiConfig.notegpt.baseUrl || 'https://api.notegpt.io';
    
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 120000, // 2 minutes for transcription
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Sanitize error to avoid logging large base64 strings
        const sanitizedError = { ...error };
        if (sanitizedError.config?.data) {
          try {
            const requestData = JSON.parse(sanitizedError.config.data);
            if (requestData.audio && typeof requestData.audio === 'string' && requestData.audio.length > 100) {
              sanitizedError.config.data = JSON.stringify({
                ...requestData,
                audio: `[base64 audio data: ${requestData.audio.length} characters]`,
              });
            }
          } catch {
            // Ignore parsing errors
          }
        }
        
        if (error.response?.status === 429) {
          throw new RateLimitError('NoteGPT', error.response.headers['retry-after']);
        }
        if (error.response) {
          throw new ExternalApiError(
            'NoteGPT',
            error.response.data?.error?.message || error.message,
            sanitizedError
          );
        }
        throw new ExternalApiError('NoteGPT', error.message, sanitizedError);
      }
    );
  }

  /**
   * Check if NoteGPT API is configured
   */
  isConfigured(): boolean {
    return isApiConfigured('notegpt');
  }

  /**
   * Transcribe audio/video from URL
   */
  async transcribeFromUrl(videoUrl: string, options?: {
    language?: string;
    includeTimestamps?: boolean;
  }): Promise<TranscriptionResult> {
    const startTime = Date.now();
    let audioFilePath: string | null = null;
    let isTempAudio = false;
    
    try {
      if (!this.isConfigured()) {
        logger.warn('NoteGPT API not configured, returning mock transcription');
        return this.getMockTranscription();
      }

      // Handle local file paths - extract audio if it's a video
      let fileToTranscribe = videoUrl;
      
      if (!videoUrl.startsWith('http')) {
        // It's a local file path
        const filePath = videoUrl.startsWith('file://') 
          ? videoUrl.replace('file://', '')
          : path.isAbsolute(videoUrl) 
            ? videoUrl 
            : path.resolve(process.cwd(), videoUrl);
        
        if (await fs.pathExists(filePath)) {
          // Check if it's a video file that needs audio extraction
          const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
          const ext = path.extname(filePath).toLowerCase();
          
          if (videoExtensions.includes(ext)) {
            logger.info(`Extracting audio from video for NoteGPT: ${filePath}`);
            audioFilePath = await audioExtractor.extractAudio(filePath, {
              format: 'mp3',
              sampleRate: 16000,
              channels: 1,
              bitrate: '128k',
            });
            isTempAudio = true;
            fileToTranscribe = audioFilePath;
          } else {
            fileToTranscribe = filePath;
          }
        }
      }

      // Call NoteGPT API
      // If it's a local file, convert to base64 and send as buffer
      if (!fileToTranscribe.startsWith('http')) {
        const audioBuffer = await fs.readFile(fileToTranscribe);
        const base64Audio = audioBuffer.toString('base64');
        const fileSizeKB = (audioBuffer.length / 1024).toFixed(2);
        
        logger.info(`Sending audio to NoteGPT API (${fileSizeKB} KB, base64 length: ${base64Audio.length})`);
        
        const response = await this.client.post('/transcribe', {
          audio: base64Audio,
          language: options?.language || 'auto',
          include_timestamps: options?.includeTimestamps !== false,
        });

        const data = response.data;
        const processingTime = Date.now() - startTime;

        return {
          transcript: data.transcript || data.text || '',
          language: data.language || 'en',
          segments: data.segments?.map((seg: any) => ({
            text: seg.text,
            start: seg.start || 0,
            end: seg.end || 0,
            confidence: seg.confidence || 0.9,
          })) || [],
          processingTimeMs: processingTime,
        };
      } else {
        // It's a URL, send URL directly
        const response = await this.client.post('/transcribe', {
          url: fileToTranscribe,
          language: options?.language || 'auto',
          include_timestamps: options?.includeTimestamps !== false,
        });

        const data = response.data;
        const processingTime = Date.now() - startTime;

        return {
          transcript: data.transcript || data.text || '',
          language: data.language || 'en',
          segments: data.segments?.map((seg: any) => ({
            text: seg.text,
            start: seg.start || 0,
            end: seg.end || 0,
            confidence: seg.confidence || 0.9,
          })) || [],
          processingTimeMs: processingTime,
        };
      }
    } catch (error: any) {
      // Sanitize error logging to avoid base64 data
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || error?.response?.status;
      
      logger.error({
        error: errorMessage,
        code: errorCode,
        url: videoUrl.substring(0, 100), // Only log first 100 chars of URL
      }, 'Error transcribing with NoteGPT');
      
      // Re-throw if API is configured (so caller can handle fallback)
      if (this.isConfigured()) {
        throw error;
      }
      
      // Only return mock if API is not configured
      return this.getMockTranscription();
    } finally {
      // Clean up temp audio file
      if (isTempAudio && audioFilePath && await fs.pathExists(audioFilePath)) {
        try {
          await fs.remove(audioFilePath);
          logger.debug(`Cleaned up temp audio file: ${audioFilePath}`);
        } catch (cleanupError) {
          logger.warn({ cleanupError }, 'Error cleaning up temp audio file');
        }
      }
    }
  }

  /**
   * Transcribe audio from file buffer
   */
  async transcribeFromBuffer(audioBuffer: Buffer, options?: {
    language?: string;
    includeTimestamps?: boolean;
  }): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConfigured()) {
        logger.warn('NoteGPT API not configured, returning mock transcription');
        return this.getMockTranscription();
      }

      // Convert buffer to base64
      const base64Audio = audioBuffer.toString('base64');

      // Call NoteGPT API
      const response = await this.client.post('/transcribe', {
        audio: base64Audio,
        language: options?.language || 'auto',
        include_timestamps: options?.includeTimestamps !== false,
      });

      const data = response.data;
      const processingTime = Date.now() - startTime;

      return {
        transcript: data.transcript || data.text || '',
        language: data.language || 'en',
        segments: data.segments?.map((seg: any) => ({
          text: seg.text,
          start: seg.start || 0,
          end: seg.end || 0,
          confidence: seg.confidence || 0.9,
        })) || [],
        processingTimeMs: processingTime,
      };
    } catch (error) {
      logger.error({ error }, 'Error transcribing audio buffer:', error);
      return this.getMockTranscription();
    }
  }

  /**
   * Get transcription status (for async jobs)
   */
  async getTranscriptionStatus(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: TranscriptionResult;
    error?: string;
  }> {
    try {
      if (!this.isConfigured()) {
        return {
          status: 'completed',
          result: this.getMockTranscription(),
        };
      }

      const response = await this.client.get(`/transcribe/${jobId}`);
      const data = response.data;

      return {
        status: data.status,
        result: data.result ? {
          transcript: data.result.transcript || '',
          language: data.result.language || 'en',
          segments: data.result.segments || [],
          processingTimeMs: data.result.processingTimeMs || 0,
        } : undefined,
        error: data.error,
      };
    } catch (error) {
      logger.error({ error }, 'Error getting transcription status:', error);
      return {
        status: 'failed',
        error: 'Failed to get transcription status',
      };
    }
  }

  /**
   * Mock transcription (fallback when API not configured)
   */
  private getMockTranscription(): TranscriptionResult {
    return {
      transcript: 'This is a mock transcription of the video content. It demonstrates how the transcription service would work with real audio.',
      language: 'en',
      segments: [
        {
          text: 'This is a mock transcription',
          start: 0,
          end: 3,
          confidence: 0.95,
        },
        {
          text: 'of the video content',
          start: 3,
          end: 6,
          confidence: 0.92,
        },
        {
          text: 'It demonstrates how the transcription service would work',
          start: 6,
          end: 10,
          confidence: 0.90,
        },
      ],
      processingTimeMs: 2000,
    };
  }
}

// Export singleton instance
export const notegptApi = new NoteGPTApiClient();
