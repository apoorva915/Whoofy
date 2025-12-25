import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { videoProcessor } from '@/services/video/processor';
import { externalApiService } from '@/services/external';
import { validateInstagramReelUrl } from '@/utils/validation';
import logger from '@/utils/logger';
import { logApiConfiguration } from '@/utils/diagnostics';

// Log API configuration on first import (module initialization)
let configLogged = false;
if (!configLogged) {
  configLogged = true;
  logApiConfiguration();
}

/**
 * POST /api/verify
 * Verify a reel submission
 */
export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
    
    // Validate request - make reelUrl required, others optional
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

    // Simple validation - just check if it's a URL
    try {
      new URL(reelUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'Invalid URL format',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    logger.info(`Verification request for: ${reelUrl}`);

    // Validate URL format
    if (!validateInstagramReelUrl(reelUrl) && !reelUrl.startsWith('http')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'Invalid reel URL format',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Process video
    const targetBrandName = body.targetBrandName || 'Cadbury Dairy Milk';
    const productNames = Array.isArray(body.productNames) ? body.productNames : [];
    
    const processingResult = await videoProcessor.processVideo(reelUrl, {
      extractFrames: true,
      frameInterval: 2, // Extract frame every 2 seconds (for full video)
      // frameCount not set - extracts frames for entire video duration
      extractAudio: true,
      recognizeAudio: true,
      analyzeFrames: true,
      targetBrandName,
      productNames,
      analyzeSentiment: true,
    });

    // Get reel metadata
    let reelMetadata = null;
    try {
      if (validateInstagramReelUrl(reelUrl)) {
        reelMetadata = await externalApiService.getInstagramReel(reelUrl);
      }
    } catch (error) {
      logger.warn({ error }, 'Could not fetch reel metadata');
    }

    // Update sentiment analysis with caption if available
    let finalSentimentAnalysis = processingResult.sentimentAnalysis;
    if (finalSentimentAnalysis && reelMetadata?.caption) {
      const { analyzeSentiment } = await import('@/services/detection/sentiment-analysis');
      finalSentimentAnalysis = analyzeSentiment(
        processingResult.transcription?.transcript || null,
        reelMetadata.caption
      );
      logger.info('Sentiment analysis updated with caption');
    }

    // Get creator profile (if Instagram URL)
    let creatorProfile = null;
    try {
      if (reelMetadata) {
        // Try to get username from metadata first (most reliable)
        let username: string | null = null;
        
        if (reelMetadata.ownerUsername) {
          username = reelMetadata.ownerUsername;
        } else if (reelMetadata.permalink) {
          // Extract username from permalink (format: instagram.com/username/reel/... or instagram.com/reel/...)
          // Try to match username before /reel/
          const usernameMatch = reelMetadata.permalink.match(/instagram\.com\/([^\/]+)\/reel\//);
          if (usernameMatch && usernameMatch[1] !== 'reel') {
            username = usernameMatch[1];
          }
        }
        
        if (username) {
          logger.info(`Fetching creator profile for username: ${username}`);
          creatorProfile = await externalApiService.getInstagramProfile(username);
        } else {
          logger.warn('Could not extract username from reel metadata');
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Could not fetch creator profile');
    }

    // Build response
    const visionStoragePath = processingResult.visionAnalysis?.storagePath
      ? processingResult.visionAnalysis.storagePath
          .replace(process.cwd(), '')
          .replace(/\\/g, '/')
      : null;

    const response = {
      success: true,
      data: {
        reelUrl,
        video: {
          id: processingResult.videoId,
          duration: processingResult.duration,
          frameCount: processingResult.frames.length,
          frames: processingResult.frames.map(f => {
            if (f.startsWith('mock://')) return null;
            // Return relative path for API endpoint
            const relativePath = f.replace(process.cwd(), '').replace(/\\/g, '/');
            // Ensure it starts with /storage/frames/ for the API endpoint
            return relativePath.startsWith('/storage/frames/') 
              ? relativePath 
              : `/storage/frames/${path.basename(f)}`;
          }).filter(Boolean),
        },
        vision: processingResult.visionAnalysis ? {
          storagePath: visionStoragePath,
          visualSummary: processingResult.visionAnalysis.visualSummary,
        } : null,
        metadata: reelMetadata ? {
          caption: reelMetadata.caption,
          likes: reelMetadata.likeCount,
          comments: reelMetadata.commentCount,
          views: reelMetadata.playCount,
          timestamp: reelMetadata.timestamp,
        } : null,
        creator: creatorProfile ? {
          username: creatorProfile.username,
          followers: creatorProfile.followersCount,
          verified: creatorProfile.isVerified,
          bio: creatorProfile.bio,
        } : null,
        audio: processingResult.audio ? {
          track: processingResult.audio.track,
          confidence: processingResult.audio.confidence,
        } : null,
        transcription: processingResult.transcription ? {
          transcript: processingResult.transcription.transcript,
          language: processingResult.transcription.language,
          processingTime: processingResult.transcription.processingTimeMs,
          segments: processingResult.transcription.segments,
        } : null,
        sentiment: finalSentimentAnalysis ? {
          transcript: {
            sentiment: finalSentimentAnalysis.transcript.sentiment,
            score: finalSentimentAnalysis.transcript.score,
            positiveCount: finalSentimentAnalysis.transcript.positiveCount,
            negativeCount: finalSentimentAnalysis.transcript.negativeCount,
            wordCount: finalSentimentAnalysis.transcript.wordCount,
          },
          caption: {
            sentiment: finalSentimentAnalysis.caption.sentiment,
            score: finalSentimentAnalysis.caption.score,
            positiveCount: finalSentimentAnalysis.caption.positiveCount,
            negativeCount: finalSentimentAnalysis.caption.negativeCount,
            wordCount: finalSentimentAnalysis.caption.wordCount,
          },
          combined: {
            sentiment: finalSentimentAnalysis.combined.sentiment,
            score: finalSentimentAnalysis.combined.score,
            positiveCount: finalSentimentAnalysis.combined.positiveCount,
            negativeCount: finalSentimentAnalysis.combined.negativeCount,
            wordCount: finalSentimentAnalysis.combined.wordCount,
            confidence: finalSentimentAnalysis.combined.confidence,
          },
          processingTime: finalSentimentAnalysis.processingTimeMs,
        } : null,
        processingTime: Date.now() - new Date(processingResult.metadata.downloadedAt).getTime(),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack,
      reelUrl: body?.reelUrl,
    }, 'Verification error');
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: error.message || 'Failed to verify reel',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
