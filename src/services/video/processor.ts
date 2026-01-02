import { videoDownloader } from './downloader';
import { frameExtractor } from './frame-extractor';
import { externalApiService } from '@/services/external';
import { frameAnalyzer } from '@/services/vision/frame-analyzer';
import { audioExtractor } from './audio-extractor';
import { localWhisperTranscriber, LocalWhisperTranscriptionResult } from '@/services/transcription/local-whisper';
import type { SentimentAnalysisResult } from '@/services/detection/sentiment-analysis';
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

    let transcription: LocalWhisperTranscriptionResult | null = null;
    if (extractedAudioPath) {
      try {
        transcription = await localWhisperTranscriber.transcribe(extractedAudioPath);
        logger.info('Local Whisper transcription completed');
      } catch (error: any) {
        logger.error({
          error: error.message,
          stack: error.stack,
          audioPath: extractedAudioPath,
        }, 'Local Whisper transcription failed');
      }
    }

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

    // Step 6: Analyze sentiment (if requested)
    let sentimentAnalysis: SentimentAnalysisResult | null = null;
    if (analyzeSentiment) {
      try {
        // Dynamic import to avoid module resolution issues
        const { analyzeSentiment: analyzeSentimentFn } = await import('@/services/detection/sentiment-analysis');
        if (typeof analyzeSentimentFn !== 'function') {
          throw new Error('analyzeSentiment is not a function');
        }
        const transcriptText = transcription?.transcript || null;
        // Note: Caption will be added from reel metadata in the API route
        sentimentAnalysis = analyzeSentimentFn(transcriptText, null);
        logger.info('Sentiment analysis completed');
      } catch (error: any) {
        logger.error({
          error: error.message,
          stack: error.stack,
        }, 'Sentiment analysis failed');
      }
    }

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
