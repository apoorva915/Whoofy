import { videoDownloader } from './downloader';
import { frameExtractor } from './frame-extractor';
import { externalApiService } from '@/services/external';
import { frameAnalyzer } from '@/services/vision/frame-analyzer';
import { audioExtractor } from './audio-extractor';
// Whisper transcription and keyword-based sentiment analysis removed
// import { localWhisperTranscriber, LocalWhisperTranscriptionResult } from '@/services/transcription/local-whisper';
// import type { SentimentAnalysisResult } from '@/services/detection/sentiment-analysis';

// Placeholder types
type LocalWhisperTranscriptionResult = null;
type SentimentAnalysisResult = null;
import logger from '@/utils/logger';
import { VisionAnalysisResult } from '@/types/vision';

/**
 * Video Processing Result
 */
export interface VideoProcessingResult {
  videoId: string;
  videoPath: string;
  duration: number;
  frames: string[];
  frameInterval: number;
  metadata: {
    url: string;
    size: number;
    downloadedAt: Date;
  };
  audio: {
    track: {
      title: string;
      artist: string;
    } | null;
    confidence: number;
  } | null;
  visionAnalysis?: VisionAnalysisResult | null;
  transcription?: LocalWhisperTranscriptionResult | null;
  sentimentAnalysis?: SentimentAnalysisResult | null;
}

/**
 * Video Processor Service
 * Orchestrates video download, frame extraction, and analysis
 */
class VideoProcessor {
  /**
   * Process video from URL
   */
  async processVideo(
    url: string,
    options: {
      extractFrames?: boolean;
      frameInterval?: number;
      frameCount?: number;
      extractAudio?: boolean;
      recognizeAudio?: boolean;
      analyzeFrames?: boolean;
      targetBrandName?: string;
      productNames?: string[]; // Optional array of product names to detect
      analyzeSentiment?: boolean;
      referenceImagePath?: string; // Optional path to reference product image for CLIP similarity (deprecated, use referenceImagePaths)
      referenceImagePaths?: string[]; // Optional array of paths to reference product images for CLIP similarity
    } = {}
  ): Promise<VideoProcessingResult> {
    const {
      extractFrames = true,
      frameInterval = 2,
      frameCount,
      extractAudio = true,
      recognizeAudio = true,
      analyzeFrames = true,
      targetBrandName = 'Cadbury Dairy Milk',
      productNames = [],
      analyzeSentiment = true,
    } = options;

    logger.info(`Processing video: ${url}`);

    // Step 1: Download video
    const downloadResult = await videoDownloader.downloadVideo(url);
    const { videoId, filePath, metadata } = downloadResult;

    // Step 1a: Validate video file before processing
    if (!filePath.startsWith('mock://')) {
      const { validateVideoFile } = await import('@/utils/video-validation');
      const validation = await validateVideoFile(filePath, {
        maxWaitTime: 10000, // Wait up to 10 seconds for file to stabilize
        checkInterval: 500,
        minFileSize: 1024, // At least 1KB
      });

      if (!validation.valid) {
        logger.error({ filePath, error: validation.error }, 'Video file validation failed');
        throw new ProcessingError(
          `Video file is invalid or incomplete: ${validation.error || 'Unknown error'}. ` +
          'The file may still be downloading or may be corrupted. Please try again.'
        );
      }
    }

    // Step 2: Get video duration
    const duration = await frameExtractor.getVideoDuration(filePath);

    // Step 3: Extract frames (if requested)
    let frames: string[] = [];
    if (extractFrames) {
      frames = await frameExtractor.extractFrames(filePath, videoId, {
        interval: frameInterval,
        count: frameCount,
      });
    }

    // Step 3a: Set reference images for CLIP similarity (if provided)
    // Support both single image (backward compatibility) and multiple images
    const referenceImagePaths = options.referenceImagePaths || 
                                (options.referenceImagePath ? [options.referenceImagePath] : []);
    
    if (referenceImagePaths.length > 0) {
      const { visionModel } = await import('@/lib/ai/vision-model');
      const embeddingPaths = await visionModel.setReferenceImages(referenceImagePaths);
      if (embeddingPaths.length > 0) {
        logger.info({ 
          count: embeddingPaths.length,
          embeddingPaths 
        }, `Reference images set for CLIP similarity matching - visual similarity enabled for ${embeddingPaths.length} image(s)`);
      } else {
        logger.warn('CLIP visual similarity is not available - dependencies may not be installed');
        logger.info('To enable CLIP, install dependencies: pip install -r yolo/requirements_clip.txt');
      }
    }

    // Step 3b: Vision analysis (if requested)
    let visionAnalysis: VisionAnalysisResult | null = null;
    if (analyzeFrames && frames.length > 0) {
      visionAnalysis = await frameAnalyzer.analyzeFrames(frames, {
        frameInterval,
        targetBrandName,
        productNames,
        videoDuration: duration,
        videoId,
      });
    }

    // Step 4: Extract audio (if requested) - audio files are saved but not transcribed
    let extractedAudioPath: string | null = null;
    if (extractAudio && !filePath.startsWith('mock://')) {
      try {
        extractedAudioPath = await audioExtractor.extractAudio(filePath, {
          format: 'mp3',
          sampleRate: 16000,
          channels: 1,
          bitrate: '128k',
        });
        logger.info(`Audio extraction completed successfully: ${extractedAudioPath}`);
      } catch (error: any) {
        logger.error({
          error: error.message,
          filePath,
          stack: error.stack,
        }, 'Audio extraction failed');
      }
    } else if (extractAudio && filePath.startsWith('mock://')) {
      logger.warn('Skipping audio extraction for mock video');
    }

    // Whisper transcription removed - use Gemini sentiment analysis instead
    const transcription: LocalWhisperTranscriptionResult | null = null;

    // Step 5: Recognize audio (if requested)
    let audio = null;
    if (recognizeAudio && !filePath.startsWith('mock://')) {
      try {
        // Use the downloaded file path for audio recognition
        const audioResult = await externalApiService.recognizeAudio(filePath);
        audio = {
          track: audioResult.track ? {
            title: audioResult.track.title,
            artist: audioResult.track.artist,
          } : null,
          confidence: audioResult.confidence,
        };
        logger.info('Audio recognition completed successfully');
      } catch (error: any) {
        logger.error({
          error: error.message,
          filePath,
        }, 'Audio recognition failed');
      }
    } else if (recognizeAudio && filePath.startsWith('mock://')) {
      logger.warn('Skipping audio recognition for mock video');
    }

    // Step 6: Sentiment analysis removed
    // Keyword-based sentiment analysis has been removed
    // Use Gemini sentiment analysis via /api/sentiment/gemini instead
    const sentimentAnalysis: SentimentAnalysisResult | null = null;

    return {
      videoId,
      videoPath: filePath,
      duration,
      frames,
      frameInterval,
      metadata,
      audio,
      visionAnalysis,
      transcription,
      sentimentAnalysis,
    };
  }
}

export const videoProcessor = new VideoProcessor();
