import { videoDownloader } from './downloader';
import { frameExtractor } from './frame-extractor';
import { externalApiService } from '@/services/external';
import { frameAnalyzer } from '@/services/vision/frame-analyzer';
import { VisualSummary } from '@/types/vision';
import logger from '@/utils/logger';

/**
 * Video Processing Result
 */
export interface VideoProcessingResult {
  videoId: string;
  videoPath: string;
  duration: number;
  frames: string[];
  metadata: {
    url: string;
    size: number;
    downloadedAt: Date;
  };
  transcription: {
    transcript: string;
    language: string;
    segments: Array<{
      text: string;
      start: number;
      end: number;
    }>;
  } | null;
  audio: {
    track: {
      title: string;
      artist: string;
    } | null;
    confidence: number;
  } | null;
  visualAnalysis: VisualSummary | null;
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
      transcribe?: boolean;
      recognizeAudio?: boolean;
      analyzeVision?: boolean;
    } = {}
  ): Promise<VideoProcessingResult> {
    const {
      extractFrames = true,
      frameInterval = 2,
      frameCount,
      transcribe = true,
      recognizeAudio = true,
      analyzeVision = true,
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

    // Step 4: Transcribe (if requested)
    let transcription = null;
    if (transcribe && !filePath.startsWith('mock://')) {
      try {
        // Use the downloaded file path for transcription
        const transcriptResult = await externalApiService.transcribeVideo(filePath);
        transcription = {
          transcript: transcriptResult.transcript,
          language: transcriptResult.language,
          segments: transcriptResult.segments.map(seg => ({
            text: seg.text,
            start: seg.start,
            end: seg.end,
          })),
        };
        logger.info('Transcription completed successfully');
      } catch (error: any) {
        logger.error({
          error: error.message,
          filePath,
          stack: error.stack,
        }, 'Transcription failed');
      }
    } else if (transcribe && filePath.startsWith('mock://')) {
      logger.warn('Skipping transcription for mock video');
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

    // Step 6: Analyze vision (if requested and frames are available)
    let visualAnalysis: VisualSummary | null = null;
    if (analyzeVision && frames.length > 0) {
      try {
        logger.info('Starting vision analysis of frames');
        visualAnalysis = await frameAnalyzer.analyzeFrames(frames, duration, frameInterval);
        logger.info('Vision analysis completed successfully');
      } catch (error: any) {
        logger.error({
          error: error.message,
          filePath,
          stack: error.stack,
        }, 'Vision analysis failed');
      }
    } else if (analyzeVision && frames.length === 0) {
      logger.warn('Skipping vision analysis - no frames available');
    }

    return {
      videoId,
      videoPath: filePath,
      duration,
      frames,
      metadata,
      transcription,
      audio,
      visualAnalysis,
    };
  }
}

export const videoProcessor = new VideoProcessor();
