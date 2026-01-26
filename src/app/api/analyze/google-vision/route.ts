import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import * as fs from 'fs-extra';
import { videoDownloader } from '@/services/video/downloader';
import { frameExtractor } from '@/services/video/frame-extractor';
import { googleVisionService } from '@/services/detection/google-vision';
import { validateVideoFile } from '@/utils/video-validation';
import logger from '@/utils/logger';

/**
 * POST /api/analyze/google-vision
 * Analyze video frames using Google Cloud Vision API
 * Features: Label detection, Text detection, Logo detection, Brand detection
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

    // Check if Google Vision API is configured
    if (!googleVisionService.isConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'API_NOT_CONFIGURED',
            message: 'Google Cloud Vision API is not configured. Please set GOOGLE_CLOUD_VISION_API_KEY and GOOGLE_CLOUD_PROJECT_ID environment variables.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const reelUrl = body.reelUrl as string;
    const targetBrandName = body.targetBrandName as string | undefined;
    const productNames = Array.isArray(body.productNames) ? body.productNames : [];
    const additionalTerms = Array.isArray(body.additionalTerms) ? body.additionalTerms : [];
    const productImages = body.productImages || []; // Base64 encoded images
    const videoId = body.videoId; // Optional: reuse videoId from previous step
    const videoPath = body.videoPath; // Optional: reuse videoPath from previous step
    const frameInterval = body.frameInterval || 2; // Default: extract frame every 2 seconds

    logger.info({ reelUrl, targetBrandName }, 'Google Vision analysis request');

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
    const frames = await frameExtractor.extractFrames(finalVideoPath, finalVideoId, {
      interval: frameInterval,
    });

    if (frames.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_FRAMES',
            message: 'No frames could be extracted from the video',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Step 4: Process product images if provided
    const referenceImagePaths: string[] = [];
    if (productImages.length > 0) {
      const tempDir = path.join(process.cwd(), 'storage', 'temp');
      await fs.ensureDir(tempDir);
      
      for (let i = 0; i < productImages.length; i++) {
        const productImage = productImages[i];
        try {
          if (typeof productImage === 'string' && productImage.startsWith('data:image/')) {
            const base64Data = productImage.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeMatch = productImage.match(/data:image\/(\w+);base64/);
            const extension = mimeMatch ? mimeMatch[1] : 'jpg';
            const imagePath = path.join(tempDir, `google_vision_product_${Date.now()}_${i}.${extension}`);
            await fs.writeFile(imagePath, buffer);
            referenceImagePaths.push(imagePath);
            logger.info({ imageIndex: i + 1, totalImages: productImages.length }, 'Product image saved for Google Vision analysis');
          }
        } catch (error: any) {
          logger.warn({ error: error?.message, imageIndex: i + 1 }, 'Failed to process product image, skipping');
        }
      }
    }

    // Step 5: Analyze frames with Google Vision API
    logger.info({ 
      frameCount: frames.length, 
      targetBrand: targetBrandName,
      productNames: productNames.length,
      additionalTerms: additionalTerms.length,
      referenceImages: referenceImagePaths.length
    }, 'Starting Google Vision analysis');
    
    const analysisResults = await googleVisionService.analyzeFrames(
      frames,
      {
        targetBrand: targetBrandName,
        productNames,
        additionalTerms,
        referenceImagePaths,
      },
      3 // Concurrency limit: 3 frames at a time
    );

    // Step 5: Aggregate results
    const allLabels = new Map<string, { count: number; totalConfidence: number }>();
    const allTexts: string[] = [];
    const allLogos = new Map<string, { count: number; totalConfidence: number }>();
    const allObjects = new Map<string, { count: number; totalConfidence: number }>();
    const allBrands = new Map<string, { count: number; totalConfidence: number; sources: Set<'label' | 'logo' | 'text'> }>();

    analysisResults.forEach(({ analysis }) => {
      // Aggregate labels
      analysis.labels.forEach(label => {
        const existing = allLabels.get(label.description) || { count: 0, totalConfidence: 0 };
        allLabels.set(label.description, {
          count: existing.count + 1,
          totalConfidence: existing.totalConfidence + label.confidence,
        });
      });

      // Aggregate text
      if (analysis.text) {
        allTexts.push(analysis.text);
      }

      // Aggregate logos
      analysis.logos.forEach(logo => {
        const existing = allLogos.get(logo.description) || { count: 0, totalConfidence: 0 };
        allLogos.set(logo.description, {
          count: existing.count + 1,
          totalConfidence: existing.totalConfidence + logo.confidence,
        });
      });

      // Aggregate objects
      analysis.objects.forEach(obj => {
        const existing = allObjects.get(obj.name) || { count: 0, totalConfidence: 0 };
        allObjects.set(obj.name, {
          count: existing.count + 1,
          totalConfidence: existing.totalConfidence + obj.confidence,
        });
      });

      // Aggregate brands
      analysis.brands.forEach(brand => {
        const existing = allBrands.get(brand.name) || { count: 0, totalConfidence: 0, sources: new Set<'label' | 'logo' | 'text'>() };
        existing.sources.add(brand.source);
        allBrands.set(brand.name, {
          count: existing.count + 1,
          totalConfidence: existing.totalConfidence + brand.confidence,
          sources: existing.sources,
        });
      });
    });

    // Calculate averages and build summary
    const labelSummary = Array.from(allLabels.entries())
      .map(([name, data]) => ({
        name,
        confidence: Number((data.totalConfidence / data.count).toFixed(3)),
        occurrences: data.count,
      }))
      .sort((a, b) => b.confidence - a.confidence);

    const logoSummary = Array.from(allLogos.entries())
      .map(([name, data]) => ({
        name,
        confidence: Number((data.totalConfidence / data.count).toFixed(3)),
        occurrences: data.count,
      }))
      .sort((a, b) => b.confidence - a.confidence);

    const objectSummary = Array.from(allObjects.entries())
      .map(([name, data]) => ({
        name,
        confidence: Number((data.totalConfidence / data.count).toFixed(3)),
        occurrences: data.count,
      }))
      .sort((a, b) => b.confidence - a.confidence);

    const brandSummary = Array.from(allBrands.entries())
      .map(([name, data]) => ({
        name,
        confidence: Number((data.totalConfidence / data.count).toFixed(3)),
        occurrences: data.count,
        sources: Array.from(data.sources),
      }))
      .sort((a, b) => b.confidence - a.confidence);

    // Check if target brand, products, or additional terms were detected
    let targetBrandDetected = false;
    let targetBrandConfidence = 0;
    const allTargetTerms = [
      targetBrandName,
      ...productNames,
      ...additionalTerms,
    ].filter((term): term is string => !!term && term.trim().length > 0);
    
    if (allTargetTerms.length > 0) {
      // Check if any target term was detected
      for (const term of allTargetTerms) {
        const termLower = term.toLowerCase();
        const detectedBrand = brandSummary.find(b => {
          const brandLower = b.name.toLowerCase();
          return brandLower === termLower ||
                 brandLower.includes(termLower) ||
                 termLower.includes(brandLower);
        });
        
        if (detectedBrand) {
          targetBrandDetected = true;
          // Use the highest confidence among all detected terms
          if (detectedBrand.confidence > targetBrandConfidence) {
            targetBrandConfidence = detectedBrand.confidence;
          }
        }
      }
      
      // Also check in labels, logos, and objects for partial matches
      if (!targetBrandDetected) {
        const allDetectedItems = [
          ...labelSummary.map(l => ({ name: l.name, confidence: l.confidence })),
          ...logoSummary.map(l => ({ name: l.name, confidence: l.confidence })),
          ...objectSummary.map(o => ({ name: o.name, confidence: o.confidence })),
        ];
        
        for (const term of allTargetTerms) {
          const termLower = term.toLowerCase();
          const match = allDetectedItems.find(item => {
            const itemLower = item.name.toLowerCase();
            return itemLower === termLower ||
                   itemLower.includes(termLower) ||
                   termLower.includes(itemLower);
          });
          
          if (match && match.confidence > 0.5) {
            targetBrandDetected = true;
            if (match.confidence > targetBrandConfidence) {
              targetBrandConfidence = match.confidence;
            }
          }
        }
      }
    }

    // Build response
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
        analysis: {
          frameAnalyses: analysisResults.map(({ framePath, timestamp, analysis }) => ({
            timestamp,
            labels: analysis.labels,
            text: analysis.text,
            textDetections: analysis.textDetections,
            logos: analysis.logos,
            objects: analysis.objects,
            brands: analysis.brands,
            visualMatches: analysis.visualMatches,
          })),
          summary: {
            labels: labelSummary,
            logos: logoSummary,
            objects: objectSummary,
            brands: brandSummary,
            allText: allTexts.join(' ').trim(),
            targetBrandDetection: allTargetTerms.length > 0 ? {
              detected: targetBrandDetected,
              confidence: targetBrandConfidence,
              message: targetBrandDetected
                ? `Target items (${allTargetTerms.join(', ')}) were detected with ${(targetBrandConfidence * 100).toFixed(1)}% confidence`
                : `Target items (${allTargetTerms.join(', ')}) were not detected in the video frames`,
            } : null,
          },
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack,
    }, 'Google Vision analysis error');
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ANALYSIS_ERROR',
          message: error.message || 'Failed to analyze video with Google Vision',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
