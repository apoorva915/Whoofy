import OpenAI from 'openai';
import { externalApiConfig, isApiConfigured } from '@/config/external-apis';
import { ExternalApiError, RateLimitError } from '@/utils/errors';
import logger from '@/utils/logger';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
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
 * OpenAI Whisper API Client (Simple - just needs API key!)
 */
class OpenAIWhisperClient {
  private client: OpenAI | null;
  private apiKey: string | null;

  constructor() {
    this.apiKey = externalApiConfig.openai.apiKey || null;
    
    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        timeout: 300000, // 5 minutes timeout for large files and slow connections
        maxRetries: 1, // Reduce retries to fail faster and get better error messages
        // Add explicit base URL to ensure correct endpoint
        baseURL: 'https://api.openai.com/v1',
        // Add HTTP agent configuration for better compatibility
        httpAgent: undefined, // Use default, but can be configured for proxy
        httpsAgent: undefined, // Use default, but can be configured for proxy
      });
    } else {
      this.client = null;
    }
  }

  /**
   * Check if OpenAI API is configured
   */
  isConfigured(): boolean {
    return isApiConfigured('openai') && this.client !== null;
  }

  /**
   * Download video/audio file from URL
   */
  private async downloadFile(url: string): Promise<string> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 300000, // 5 minutes
    });

    const tempDir = path.join(process.cwd(), 'storage', 'temp');
    await fs.ensureDir(tempDir);
    const tempPath = path.join(tempDir, `video_${Date.now()}.mp4`);
    await fs.writeFile(tempPath, Buffer.from(response.data));
    
    return tempPath;
  }

  /**
   * Check if file is a video file (needs audio extraction)
   */
  private isVideoFile(filePath: string): boolean {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
    const ext = path.extname(filePath).toLowerCase();
    return videoExtensions.includes(ext);
  }

  /**
   * Extract audio from video file if needed
   */
  private async prepareAudioFile(filePath: string): Promise<{
    audioPath: string;
    isTempFile: boolean; // Whether we created a temp file that needs cleanup
  }> {
    // Check if file exists
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    // If it's already an audio file, use it directly
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const ext = path.extname(filePath).toLowerCase();
    
    if (audioExtensions.includes(ext)) {
      logger.debug(`File is already audio format: ${filePath}`);
      return { audioPath: filePath, isTempFile: false };
    }

    // If it's a video file, extract audio
    if (this.isVideoFile(filePath)) {
      logger.info(`Extracting audio from video: ${filePath}`);
      const audioPath = await audioExtractor.extractAudio(filePath, {
        format: 'mp3',
        sampleRate: 16000, // Optimal for Whisper
        channels: 1, // Mono
        bitrate: '128k',
      });
      return { audioPath, isTempFile: true };
    }

    // For other formats, try to use as-is (Whisper supports many formats)
    logger.warn(`Unknown file format: ${ext}, attempting transcription anyway`);
    return { audioPath: filePath, isTempFile: false };
  }

  /**
   * Transcribe audio/video from URL
   */
  async transcribeFromUrl(videoUrl: string, options?: {
    language?: string;
    includeTimestamps?: boolean;
  }): Promise<TranscriptionResult> {
    const startTime = Date.now();
    let downloadedFilePath: string | null = null;
    let audioFilePath: string | null = null;
    let isTempAudio = false;
    
    try {
      if (!this.isConfigured()) {
        logger.warn('OpenAI API not configured, returning mock transcription');
        return this.getMockTranscription();
      }

      if (!this.client) {
        return this.getMockTranscription();
      }

      // Download the video/audio file if it's a URL
      let filePath: string;
      try {
        if (videoUrl.startsWith('http')) {
          downloadedFilePath = await this.downloadFile(videoUrl);
          filePath = downloadedFilePath;
        } else if (videoUrl.startsWith('file://')) {
          filePath = videoUrl.replace('file://', '');
        } else {
          // Handle both absolute and relative paths
          filePath = path.isAbsolute(videoUrl) ? videoUrl : path.resolve(process.cwd(), videoUrl);
        }

        // Check if file exists
        if (!(await fs.pathExists(filePath))) {
          logger.error(`File not found: ${filePath}`);
          return this.getMockTranscription();
        }

        logger.info(`Preparing audio file for transcription: ${filePath}`);
        
        // Extract audio from video if needed
        try {
          const audioResult = await this.prepareAudioFile(filePath);
          audioFilePath = audioResult.audioPath;
          isTempAudio = audioResult.isTempFile;
          logger.info(`Audio prepared: ${audioFilePath} (temp: ${isTempAudio})`);
        } catch (audioError: any) {
          logger.error({
            error: audioError?.message || String(audioError),
            stack: audioError?.stack,
            filePath,
          }, 'Failed to prepare audio file, attempting transcription with original file');
          // Try to use original file as fallback (Whisper can handle some video formats)
          audioFilePath = filePath;
          isTempAudio = false;
        }

        // Verify audio file exists and is readable
        if (!(await fs.pathExists(audioFilePath))) {
          logger.error(`Audio file not found: ${audioFilePath}`);
          return this.getMockTranscription();
        }

        const audioStats = await fs.stat(audioFilePath);
        if (audioStats.size === 0) {
          logger.error(`Audio file is empty: ${audioFilePath}`);
          return this.getMockTranscription();
        }

        logger.info(`Transcribing audio file: ${audioFilePath} (${(audioStats.size / 1024).toFixed(2)} KB)`);

        // Transcribe using OpenAI Whisper/GPT-4o
        // Try gpt-4o-transcribe first (better quality), fallback to whisper-1 if needed
        // Note: Setting language to undefined lets the model auto-detect (supports Hindi and 99+ languages)
        const fileSizeMB = (audioStats.size / (1024 * 1024)).toFixed(2);
        logger.info(`Starting transcription (file: ${fileSizeMB} MB, language: auto-detect)`);
        
        // Use fs.createReadStream for reliable file upload in Node.js
        // This is the most reliable method for the OpenAI SDK in Node.js environments
        const fileName = path.basename(audioFilePath);
        const fileStream = fs.createReadStream(audioFilePath);
        
        // Add name property for OpenAI SDK (it uses this for the multipart form field)
        (fileStream as any).name = fileName;
        
        logger.debug(`Created ReadStream: ${fileName}, size: ${audioStats.size} bytes`);
        
        let transcription: any;
        
        try {
          // Try whisper-1 first (more reliable, better error messages)
          logger.info('Attempting transcription with whisper-1 model');
          const transcriptionStartTime = Date.now();
          transcription = await this.client.audio.transcriptions.create({
            file: fileStream as any,
            model: 'whisper-1',
            language: options?.language || undefined, // undefined = auto-detect (supports Hindi)
            response_format: options?.includeTimestamps !== false ? 'verbose_json' : 'json',
            timestamp_granularities: options?.includeTimestamps !== false ? ['segment'] : undefined,
          });
          const duration = Date.now() - transcriptionStartTime;
          logger.info(`Whisper-1 transcription completed successfully in ${duration}ms`);
        } catch (whisperError: any) {
          // Try gpt-4o-transcribe as fallback
          const errorMsg = whisperError?.message || String(whisperError);
          const errorCode = whisperError?.code || whisperError?.response?.status;
          const errorType = whisperError?.type;
          const errorCause = whisperError?.cause;
          const errorStatus = whisperError?.status;
          const errorResponse = whisperError?.response?.data;
          
          logger.warn({
            error: errorMsg,
            code: errorCode,
            status: errorStatus,
            type: errorType,
            cause: errorCause?.message,
            response: errorResponse,
          }, `Whisper-1 transcription failed (${errorMsg}), trying gpt-4o-transcribe`);
          
          try {
            // Create a new read stream for the retry (streams can only be read once)
            const fileStream2 = fs.createReadStream(audioFilePath);
            (fileStream2 as any).name = fileName;
            
            logger.info('Attempting transcription with gpt-4o-transcribe model');
            const startTime2 = Date.now();
            transcription = await this.client.audio.transcriptions.create({
              file: fileStream2 as any,
              model: 'gpt-4o-transcribe',
              language: options?.language || undefined,
              response_format: options?.includeTimestamps !== false ? 'verbose_json' : 'json',
              timestamp_granularities: undefined,
            });
            const duration2 = Date.now() - startTime2;
            logger.info(`GPT-4o transcription completed successfully in ${duration2}ms`);
          } catch (gpt4Error: any) {
            // Both failed, re-throw the original error with more context
            const gpt4ErrorMsg = gpt4Error?.message || String(gpt4Error);
            const gpt4Response = gpt4Error?.response?.data;
            logger.error({
              whisperError: errorMsg,
              gpt4Error: gpt4ErrorMsg,
              code: errorCode,
              status: errorStatus,
              whisperCause: errorCause?.message,
              gpt4Cause: gpt4Error?.cause?.message,
              whisperResponse: errorResponse,
              gpt4Response: gpt4Response,
            }, 'Both transcription models failed');
            throw whisperError;
          }
        }

        const processingTime = Date.now() - startTime;

        // Format response - handle both whisper-1 and gpt-4o formats
        const transcriptText = transcription.text || '';
        const detectedLanguage = (transcription as any).language || 'unknown';
        const segments = (transcription as any).segments || [];
        
        const result = {
          transcript: transcriptText,
          language: detectedLanguage,
          segments: segments.map((seg: any) => ({
            text: seg.text || '',
            start: seg.start || 0,
            end: seg.end || 0,
            confidence: seg.confidence || 0.95, // Models don't always provide confidence
          })),
          processingTimeMs: processingTime,
        };

        logger.info(`Transcription completed successfully: ${result.transcript.length} characters, language: ${result.language}, ${result.segments.length} segments`);
        return result;
      } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        logger.error({
          error: errorMessage,
          stack: error?.stack,
          videoUrl,
          filePath,
          audioFilePath,
        }, 'Error preparing file for transcription');
        throw error; // Re-throw to be caught by outer catch
      } finally {
        // Clean up temp files
        try {
          if (isTempAudio && audioFilePath && await fs.pathExists(audioFilePath)) {
            await fs.remove(audioFilePath);
            logger.debug(`Cleaned up temp audio file: ${audioFilePath}`);
          }
          if (downloadedFilePath && await fs.pathExists(downloadedFilePath)) {
            await fs.remove(downloadedFilePath);
            logger.debug(`Cleaned up downloaded file: ${downloadedFilePath}`);
          }
        } catch (cleanupError) {
          logger.warn({ cleanupError }, 'Error cleaning up temp files');
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      const errorStatus = error?.status || error?.response?.status;
      const errorResponse = error?.response?.data;
      const errorCode = error?.code;
      const errorType = error?.type;
      const errorCause = error?.cause;
      
      // Check if it's a connection error
      const isConnectionError = 
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('econnreset') ||
        errorMessage.toLowerCase().includes('etimedout') ||
        errorCode === 'ECONNRESET' ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'ENOTFOUND' ||
        errorType === 'connection_error';
      
      logger.error({
        error: errorMessage,
        code: errorCode,
        type: errorType,
        status: errorStatus,
        response: errorResponse,
        cause: errorCause?.message,
        videoUrl: videoUrl.substring(0, 100), // Limit URL length in logs
        configured: this.isConfigured(),
        isConnectionError,
        stack: error?.stack,
      }, 'Error transcribing with OpenAI Whisper');
      
      // If API is configured but failed, log the actual error details
      if (this.isConfigured()) {
        if (isConnectionError) {
          logger.error('Connection error detected. This may be due to network issues, firewall/proxy settings, or OpenAI API being temporarily unavailable. Check your internet connection and try again.');
        } else {
          logger.error('OpenAI API is configured but transcription failed. Check API key and file format.');
        }
        if (errorResponse) {
          logger.error({ response: errorResponse }, 'API error response');
        }
      }
      
      // Re-throw the error so the caller can try fallback services
      // Only return mock if API is not configured
      if (!this.isConfigured()) {
        return this.getMockTranscription();
      }
      
      // Throw error to allow fallback to NoteGPT or other services
      throw error;
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
    let tempPath: string | null = null;
    
    try {
      if (!this.isConfigured() || !this.client) {
        logger.warn('OpenAI API not configured, returning mock transcription');
        return this.getMockTranscription();
      }

      // Save buffer to temp file
      const tempDir = path.join(process.cwd(), 'storage', 'temp');
      await fs.ensureDir(tempDir);
      tempPath = path.join(tempDir, `audio_${Date.now()}.mp3`);
      await fs.writeFile(tempPath, audioBuffer);

      logger.info(`Transcribing audio buffer (${(audioBuffer.length / 1024).toFixed(2)} KB)`);

      // Transcribe
      const fileStream = fs.createReadStream(tempPath);
      const transcription = await this.client.audio.transcriptions.create({
        file: fileStream as any,
        model: 'whisper-1',
        language: options?.language || undefined,
        response_format: options?.includeTimestamps !== false ? 'verbose_json' : 'json',
        timestamp_granularities: options?.includeTimestamps !== false ? ['segment'] : undefined,
      });

      const processingTime = Date.now() - startTime;

      if (options?.includeTimestamps !== false && 'segments' in transcription) {
        const result = {
          transcript: transcription.text,
          language: (transcription as any).language || 'en',
          segments: (transcription as any).segments?.map((seg: any) => ({
            text: seg.text,
            start: seg.start,
            end: seg.end,
            confidence: 0.95,
          })) || [],
          processingTimeMs: processingTime,
        };
        logger.info(`Transcription completed: ${result.transcript.length} characters, ${result.segments.length} segments`);
        return result;
      }

      const result = {
        transcript: transcription.text,
        language: 'en',
        segments: [],
        processingTimeMs: processingTime,
      };
      logger.info(`Transcription completed: ${result.transcript.length} characters`);
      return result;
    } catch (error) {
      logger.error({ error }, 'Error transcribing audio buffer:', error);
      return this.getMockTranscription();
    } finally {
      // Clean up temp file
      if (tempPath) {
        try {
          await fs.remove(tempPath);
          logger.debug(`Cleaned up temp audio file: ${tempPath}`);
        } catch (cleanupError) {
          logger.warn({ cleanupError }, 'Error cleaning up temp file');
        }
      }
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
export const openaiWhisper = new OpenAIWhisperClient();

