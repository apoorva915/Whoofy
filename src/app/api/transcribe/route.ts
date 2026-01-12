import { NextRequest, NextResponse } from 'next/server';
import { videoDownloader } from '@/services/video/downloader';
import { audioExtractor } from '@/services/video/audio-extractor';
import { localWhisperTranscriber } from '@/services/transcription/local-whisper';
import { analyzeSentiment } from '@/services/detection/sentiment-analysis';
import { externalApiService } from '@/services/external';
import { validateInstagramReelUrl } from '@/utils/validation';
import logger from '@/utils/logger';
import { validateVideoFile } from '@/utils/video-validation';

/**
 * POST /api/transcribe
 * Download video, extract audio, transcribe with Whisper, and perform sentiment analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.reelUrl || typeof body.reelUrl !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'reelUrl is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const reelUrl = body.reelUrl as string;
    const caption = body.caption || null; // Optional caption from previous step

    logger.info(`Transcription request for: ${reelUrl}`);

    // Step 1: Download video
    const downloadResult = await videoDownloader.downloadVideo(reelUrl);
    const { videoId, filePath, metadata } = downloadResult;

    // Validate video file
    if (!filePath.startsWith('mock://')) {
      const validation = await validateVideoFile(filePath, {
        maxWaitTime: 10000,
        checkInterval: 500,
        minFileSize: 1024,
      });

      if (!validation.valid) {
        logger.error({ filePath, error: validation.error }, 'Video file validation failed');
        throw new Error(
          `Video file is invalid or incomplete: ${validation.error || 'Unknown error'}`
        );
      }
    }

    // Step 2: Extract audio
    let extractedAudioPath: string | null = null;
    if (!filePath.startsWith('mock://')) {
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
        throw error;
      }
    }

    // Step 3: Transcribe with Whisper
    let transcription = null;
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
        throw error;
      }
    }

    // Step 4: Get caption from reel metadata if not provided
    let finalCaption = caption;
    if (!finalCaption) {
      try {
        if (validateInstagramReelUrl(reelUrl)) {
          const reelMetadata = await externalApiService.getInstagramReel(reelUrl);
          finalCaption = reelMetadata?.caption || null;
        }
      } catch (error) {
        logger.warn({ error }, 'Could not fetch reel metadata for caption');
      }
    }

    // Step 5: Perform sentiment analysis
    let sentimentAnalysis = null;
    try {
      const transcriptText = transcription?.transcript || null;
      sentimentAnalysis = analyzeSentiment(transcriptText, finalCaption);
      logger.info('Sentiment analysis completed');
    } catch (error: any) {
      logger.error({
        error: error.message,
        stack: error.stack,
      }, 'Sentiment analysis failed');
      throw error;
    }

    const response = {
      success: true,
      data: {
        reelUrl,
        videoId,
        videoPath: filePath,
        transcription: transcription ? {
          transcript: transcription.transcript,
          language: transcription.language,
          processingTime: transcription.processingTimeMs,
          segments: transcription.segments,
        } : null,
        sentiment: sentimentAnalysis ? {
          transcript: {
            sentiment: sentimentAnalysis.transcript.sentiment,
            score: sentimentAnalysis.transcript.score,
            positiveCount: sentimentAnalysis.transcript.positiveCount,
            negativeCount: sentimentAnalysis.transcript.negativeCount,
            wordCount: sentimentAnalysis.transcript.wordCount,
          },
          caption: {
            sentiment: sentimentAnalysis.caption.sentiment,
            score: sentimentAnalysis.caption.score,
            positiveCount: sentimentAnalysis.caption.positiveCount,
            negativeCount: sentimentAnalysis.caption.negativeCount,
            wordCount: sentimentAnalysis.caption.wordCount,
          },
          combined: {
            sentiment: sentimentAnalysis.combined.sentiment,
            score: sentimentAnalysis.combined.score,
            positiveCount: sentimentAnalysis.combined.positiveCount,
            negativeCount: sentimentAnalysis.combined.negativeCount,
            wordCount: sentimentAnalysis.combined.wordCount,
            confidence: sentimentAnalysis.combined.confidence,
          },
          processingTime: sentimentAnalysis.processingTimeMs,
        } : null,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack,
    }, 'Transcription error');
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TRANSCRIPTION_ERROR',
          message: error.message || 'Failed to transcribe video',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

