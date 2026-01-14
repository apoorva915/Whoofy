import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import * as fs from 'fs-extra';
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
    
    // Handle product image uploads (base64, URLs, or file paths) - support multiple images
    const referenceImagePaths: string[] = [];
    
    // Support both single image (backward compatibility) and multiple images
    const productImages = body.productImages || (body.productImage ? [body.productImage] : []);
    
    if (productImages.length > 0) {
      const tempDir = path.join(process.cwd(), 'storage', 'temp');
      await fs.ensureDir(tempDir);
      
      for (let i = 0; i < productImages.length; i++) {
        const productImage = productImages[i];
        try {
          let imagePath: string | null = null;
          
          // Check if it's base64 data
          if (typeof productImage === 'string' && productImage.startsWith('data:image/')) {
            // Extract base64 data
            const base64Data = productImage.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Determine image extension from data URL
            const mimeMatch = productImage.match(/data:image\/(\w+);base64/);
            const extension = mimeMatch ? mimeMatch[1] : 'jpg';
            
            // Save to temp directory
            imagePath = path.join(tempDir, `product_image_${Date.now()}_${i}.${extension}`);
            await fs.writeFile(imagePath, buffer);
            
            logger.info({ imageIndex: i + 1, totalImages: productImages.length }, 'Product image saved from base64 data');
          } else if (typeof productImage === 'string' && productImage.startsWith('http')) {
            // It's a URL - download it
            const response = await fetch(productImage);
            if (response.ok) {
              const buffer = Buffer.from(await response.arrayBuffer());
              const contentType = response.headers.get('content-type') || 'image/jpeg';
              const extension = contentType.split('/')[1] || 'jpg';
              
              imagePath = path.join(tempDir, `product_image_${Date.now()}_${i}.${extension}`);
              await fs.writeFile(imagePath, buffer);
              
              logger.info({ imageIndex: i + 1, totalImages: productImages.length }, 'Product image downloaded from URL');
            }
          } else if (typeof productImage === 'string') {
            // Assume it's a file path
            if (await fs.pathExists(productImage)) {
              imagePath = productImage;
              logger.info({ imageIndex: i + 1, totalImages: productImages.length }, 'Using provided product image path');
            }
          }
          
          if (imagePath) {
            referenceImagePaths.push(imagePath);
          }
        } catch (error: any) {
          logger.warn({ error: error?.message, imageIndex: i + 1 }, 'Failed to process product image, skipping');
        }
      }
      
      if (referenceImagePaths.length > 0) {
        logger.info({ count: referenceImagePaths.length }, `Processed ${referenceImagePaths.length} product image(s) for CLIP similarity`);
      }
    }
    
    const processingResult = await videoProcessor.processVideo(reelUrl, {
      extractFrames: true,
      frameInterval: 2, // Extract frame every 2 seconds (for full video)
      // frameCount not set - extracts frames for entire video duration
      extractAudio: true,
      recognizeAudio: true,
      analyzeFrames: true,
      targetBrandName,
      productNames,
      analyzeSentiment: false, // Disabled - keyword-based sentiment analysis removed
      referenceImagePaths: referenceImagePaths.length > 0 ? referenceImagePaths : undefined, // Changed to plural
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

    // Keyword-based sentiment analysis has been removed
    // Use Gemini sentiment analysis via /api/sentiment/gemini instead
    let finalSentimentAnalysis = null;

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
