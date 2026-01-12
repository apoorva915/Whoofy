import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import * as fs from 'fs-extra';
import { videoDownloader } from '@/services/video/downloader';
import { frameExtractor } from '@/services/video/frame-extractor';
import { frameAnalyzer } from '@/services/vision/frame-analyzer';
import { validateVideoFile } from '@/utils/video-validation';
import logger from '@/utils/logger';

/**
 * POST /api/analyze
 * Analyze video frames using OCR, YOLO, and CLIP
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
    const targetBrandName = body.targetBrandName || 'Cadbury Dairy Milk';
    const productNames = Array.isArray(body.productNames) ? body.productNames : [];
    const videoId = body.videoId; // Optional: reuse videoId from previous step
    const videoPath = body.videoPath; // Optional: reuse videoPath from previous step

    logger.info(`Video analysis request for: ${reelUrl}`);

    // Step 1: Download video (if not already downloaded)
    let finalVideoId: string;
    let finalVideoPath: string;
    let metadata: any;

    if (videoId && videoPath && await fs.pathExists(videoPath)) {
      // Reuse existing video
      finalVideoId = videoId;
      finalVideoPath = videoPath;
      logger.info(`Reusing existing video: ${videoPath}`);
    } else {
      // Download video
      const downloadResult = await videoDownloader.downloadVideo(reelUrl);
      finalVideoId = downloadResult.videoId;
      finalVideoPath = downloadResult.filePath;
      metadata = downloadResult.metadata;
    }

    // Validate video file
    if (!finalVideoPath.startsWith('mock://')) {
      const validation = await validateVideoFile(finalVideoPath, {
        maxWaitTime: 10000,
        checkInterval: 500,
        minFileSize: 1024,
      });

      if (!validation.valid) {
        logger.error({ filePath: finalVideoPath, error: validation.error }, 'Video file validation failed');
        throw new Error(
          `Video file is invalid or incomplete: ${validation.error || 'Unknown error'}`
        );
      }
    }

    // Step 2: Get video duration
    const duration = await frameExtractor.getVideoDuration(finalVideoPath);

    // Step 3: Extract frames
    const frameInterval = 2; // Extract frame every 2 seconds
    const frames = await frameExtractor.extractFrames(finalVideoPath, finalVideoId, {
      interval: frameInterval,
      // frameCount not set - extracts frames for entire video duration
    });

    // Step 4: Handle product image uploads for CLIP similarity
    const referenceImagePaths: string[] = [];
    const productImages = body.productImages || [];
    
    if (productImages.length > 0) {
      const tempDir = path.join(process.cwd(), 'storage', 'temp');
      await fs.ensureDir(tempDir);
      
      for (let i = 0; i < productImages.length; i++) {
        const productImage = productImages[i];
        try {
          let imagePath: string | null = null;
          
          // Check if it's base64 data
          if (typeof productImage === 'string' && productImage.startsWith('data:image/')) {
            const base64Data = productImage.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeMatch = productImage.match(/data:image\/(\w+);base64/);
            const extension = mimeMatch ? mimeMatch[1] : 'jpg';
            imagePath = path.join(tempDir, `product_image_${Date.now()}_${i}.${extension}`);
            await fs.writeFile(imagePath, buffer);
            logger.info({ imageIndex: i + 1, totalImages: productImages.length }, 'Product image saved from base64 data');
          } else if (typeof productImage === 'string' && productImage.startsWith('http')) {
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

    // Step 5: Set reference images for CLIP similarity (if provided)
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
      }
    }

    // Step 6: Analyze frames with YOLO, OCR, and CLIP
    let visionAnalysis = null;
    if (frames.length > 0) {
      visionAnalysis = await frameAnalyzer.analyzeFrames(frames, {
        frameInterval,
        targetBrandName,
        productNames,
        videoDuration: duration,
        videoId: finalVideoId,
      });
    }

    // Build response
    const visionStoragePath = visionAnalysis?.storagePath
      ? visionAnalysis.storagePath
          .replace(process.cwd(), '')
          .replace(/\\/g, '/')
      : null;

    const response = {
      success: true,
      data: {
        reelUrl,
        video: {
          id: finalVideoId,
          duration,
          frameCount: frames.length,
          frames: frames.map(f => {
            if (f.startsWith('mock://')) return null;
            const relativePath = f.replace(process.cwd(), '').replace(/\\/g, '/');
            return relativePath.startsWith('/storage/frames/') 
              ? relativePath 
              : `/storage/frames/${path.basename(f)}`;
          }).filter(Boolean),
        },
        vision: visionAnalysis ? {
          storagePath: visionStoragePath,
          visualSummary: visionAnalysis.visualSummary,
        } : null,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack,
    }, 'Video analysis error');
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ANALYSIS_ERROR',
          message: error.message || 'Failed to analyze video',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

