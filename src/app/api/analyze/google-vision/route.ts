import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import * as fs from 'fs-extra';
import { videoDownloader } from '@/services/video/downloader';
import { frameExtractor } from '@/services/video/frame-extractor';
import { googleVisionService } from '@/services/detection/google-vision';
import { validateVideoFile } from '@/utils/video-validation';
import { normalizeReelUrlCanonical } from '@/utils/validation';
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

    const reelUrl = normalizeReelUrlCanonical(body.reelUrl as string) || (body.reelUrl as string);
    const targetBrandName = body.targetBrandName as string | undefined;
    const productNames = Array.isArray(body.productNames) ? body.productNames : [];
    const additionalTerms = Array.isArray(body.additionalTerms) ? body.additionalTerms : [];
    const targetGender = (body.targetGender as string)?.trim() || undefined;
    const targetAge = (body.targetAge as string)?.trim() || undefined;
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
    
    let analysisResults = await googleVisionService.analyzeFrames(
      frames,
      {
        targetBrand: targetBrandName,
        productNames,
        additionalTerms,
        referenceImagePaths,
        frameInterval,
      },
      3
    );

    // If reference images were used and no frame matched, retry with denser frames (1 per second)
    const hasReferenceMatch = analysisResults.some(
      r => r.analysis.visualMatches?.some((m: any) => m.match)
    );
    if (referenceImagePaths.length > 0 && !hasReferenceMatch && !finalVideoPath.startsWith('mock://')) {
      const denseInterval = 1;
      logger.info({ previousInterval: frameInterval, newInterval: denseInterval }, 'No reference match; retrying with more frames per second');
      const denseFrames = await frameExtractor.extractFrames(finalVideoPath, finalVideoId, { interval: denseInterval });
      if (denseFrames.length > 0) {
        analysisResults = await googleVisionService.analyzeFrames(
          denseFrames,
          {
            targetBrand: targetBrandName,
            productNames,
            additionalTerms,
            referenceImagePaths,
            frameInterval: denseInterval,
          },
          3
        );
      }
    }

    // Step 6: Aggregate results
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

    // Separate detection: brands (targetBrandName), products (productNames), objects (additionalTerms)
    const brandTerms = (targetBrandName ? [targetBrandName.trim()] : []).filter(Boolean);
    const productTerms = (productNames || []).map((t: string) => t.trim()).filter(Boolean);
    const objectTerms = (additionalTerms || []).map((t: string) => t.trim()).filter(Boolean);

    const matchTerm = (term: string, items: Array<{ name: string; confidence: number }>) => {
      const termLower = term.toLowerCase();
      return items.find(item => {
        const itemLower = item.name.toLowerCase();
        return itemLower === termLower || itemLower.includes(termLower) || termLower.includes(itemLower);
      });
    };

    const brandDetected: string[] = [];
    let brandMaxConfidence = 0;
    for (const term of brandTerms) {
      const inBrands = matchTerm(term, brandSummary);
      const inLogos = matchTerm(term, logoSummary);
      const inLabels = matchTerm(term, labelSummary);
      const m = inBrands || inLogos || inLabels;
      if (m && m.confidence > 0.5) {
        brandDetected.push(term);
        if (m.confidence > brandMaxConfidence) brandMaxConfidence = m.confidence;
      }
    }

    const productDetected: string[] = [];
    let productMaxConfidence = 0;
    for (const term of productTerms) {
      const inBrands = matchTerm(term, brandSummary);
      const inLabels = matchTerm(term, labelSummary);
      const inLogos = matchTerm(term, logoSummary);
      const m = inBrands || inLabels || inLogos;
      if (m && m.confidence > 0.5) {
        productDetected.push(term);
        if (m.confidence > productMaxConfidence) productMaxConfidence = m.confidence;
      }
    }

    const objectDetected: string[] = [];
    let objectMaxConfidence = 0;
    for (const term of objectTerms) {
      const inObjects = matchTerm(term, objectSummary);
      const inLabels = matchTerm(term, labelSummary);
      const m = inObjects || inLabels;
      if (m && m.confidence > 0.5) {
        objectDetected.push(term);
        if (m.confidence > objectMaxConfidence) objectMaxConfidence = m.confidence;
      }
    }

    // Legacy single combined flag for backward compatibility
    const allTargetTerms = [...brandTerms, ...productTerms, ...objectTerms];
    const targetBrandDetected = brandDetected.length > 0 || productDetected.length > 0 || objectDetected.length > 0;
    const targetBrandConfidence = Math.max(brandMaxConfidence, productMaxConfidence, objectMaxConfidence);

    // Demographic match (when target gender/age provided)
    let demographicMatch: { matched: boolean; targetGender?: string; targetAge?: string; detectedGender?: string; detectedAge?: string; frameCount: number; reasoning: string } | undefined;
    if (targetGender || targetAge) {
      const allPeople: { gender: string; ageBracket: string }[] = [];
      analysisResults.forEach(({ analysis }) => {
        (analysis.people || []).forEach((p: any) => {
          allPeople.push({
            gender: (p.gender || 'unknown').toLowerCase(),
            ageBracket: (p.ageBracket || 'unknown').replace(/_/g, ' '),
          });
        });
      });
      const peopleFrames = analysisResults.filter((r) => r.analysis.people && r.analysis.people.length > 0);
      if (allPeople.length === 0) {
        demographicMatch = {
          matched: false,
          targetGender,
          targetAge,
          frameCount: 0,
          reasoning: 'No people detected in any frame.',
        };
      } else {
        const genderCounts: Record<string, number> = {};
        const ageCounts: Record<string, number> = {};
        allPeople.forEach((p) => {
          genderCounts[p.gender] = (genderCounts[p.gender] || 0) + 1;
          ageCounts[p.ageBracket] = (ageCounts[p.ageBracket] || 0) + 1;
        });
        const topGender = Object.entries(genderCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const topAge = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const tg = targetGender?.toLowerCase().replace(/_/g, ' ');
        const ta = targetAge?.toLowerCase().replace(/_/g, ' ');
        const genderMatch = !tg || topGender === tg;
        const ageMatch = !ta || topAge === ta;
        const matched = genderMatch && ageMatch;
        demographicMatch = {
          matched,
          targetGender,
          targetAge,
          detectedGender: topGender,
          detectedAge: topAge,
          frameCount: peopleFrames.length,
          reasoning: `Detected: ${topGender || '—'} (gender), ${topAge || '—'} (age) in ${peopleFrames.length} frame(s). Target: ${targetGender || '—'} (gender), ${targetAge || '—'} (age). ${matched ? 'Match.' : 'No match.'}`,
        };
      }
    }

    // Save to database if analysis was successful
    let videoAnalysisId: string | null = null;
    if (analysisResults.length > 0 && frames.length > 0) {
      try {
        const { v4: uuidv4 } = await import('uuid');
        const prisma = (await import('@/config/database')).default;
        
        videoAnalysisId = uuidv4();
        const reelId = reelUrl.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] || null;
        
        // Create video_analyses record
        await prisma.$executeRawUnsafe(`
          INSERT INTO aimodule.video_analyses (id, "reelUrl", "reelId", "videoId", duration, "frameCount", "analysisType", status, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            duration = EXCLUDED.duration,
            "frameCount" = EXCLUDED."frameCount",
            status = EXCLUDED.status,
            "updatedAt" = NOW()
        `, videoAnalysisId, reelUrl, reelId, finalVideoId, duration, frames.length, 'google-vision', 'completed');

        // Create frame_analyses records
        for (const { framePath, timestamp, analysis } of analysisResults) {
          const frameId = uuidv4();
          const relativeFramePath = framePath?.startsWith('mock://') ? null : 
            framePath?.replace(process.cwd(), '').replace(/\\/g, '/');
          
          await prisma.$executeRawUnsafe(`
            INSERT INTO aimodule.frame_analyses (id, "videoAnalysisId", timestamp, "framePath", objects, labels, text, "textDetections", logos, brands, people, "visualSimilarity", "createdAt")
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, NOW())
          `,
            frameId,
            videoAnalysisId,
            timestamp,
            relativeFramePath,
            JSON.stringify(analysis.objects || []),
            JSON.stringify(analysis.labels || []),
            analysis.text || null,
            JSON.stringify(analysis.textDetections || []),
            JSON.stringify(analysis.logos || []),
            JSON.stringify(analysis.brands || []),
            JSON.stringify(analysis.people || []),
            analysis.visualMatches ? JSON.stringify(analysis.visualMatches) : null
          );
        }

        // Create video_analysis_summaries record
        const summaryId = uuidv4();
        await prisma.$executeRawUnsafe(`
          INSERT INTO aimodule.video_analysis_summaries (id, "videoAnalysisId", "uniqueObjects", "brandsDetected", "targetBrandConfirmation", "visualSentiment", "visualSimilaritySummary", "createdAt", "updatedAt")
          VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, NOW(), NOW())
          ON CONFLICT ("videoAnalysisId") DO UPDATE SET
            "uniqueObjects" = EXCLUDED."uniqueObjects",
            "brandsDetected" = EXCLUDED."brandsDetected",
            "targetBrandConfirmation" = EXCLUDED."targetBrandConfirmation",
            "visualSentiment" = EXCLUDED."visualSentiment",
            "visualSimilaritySummary" = EXCLUDED."visualSimilaritySummary",
            "updatedAt" = NOW()
        `,
          summaryId,
          videoAnalysisId,
          JSON.stringify(objectSummary.map((o: any) => o.name) || []),
          JSON.stringify(brandSummary || []),
          JSON.stringify(allTargetTerms.length > 0 ? {
            detected: targetBrandDetected,
            confidence: targetBrandConfidence,
            message: targetBrandDetected
              ? `Target items (${allTargetTerms.join(', ')}) were detected with ${(targetBrandConfidence * 100).toFixed(1)}% confidence`
              : `Target items (${allTargetTerms.join(', ')}) were not detected in the video frames`,
            brandDetection: brandTerms.length > 0 ? { detected: brandDetected.length > 0, items: brandTerms, detectedItems: brandDetected, confidence: brandMaxConfidence, message: brandDetected.length > 0 ? `Brand(s) ${brandDetected.join(', ')} detected (${(brandMaxConfidence * 100).toFixed(1)}%)` : `Brand(s) ${brandTerms.join(', ')} not detected` } : null,
            productDetection: productTerms.length > 0 ? { detected: productDetected.length > 0, items: productTerms, detectedItems: productDetected, confidence: productMaxConfidence, message: productDetected.length > 0 ? `Product(s) ${productDetected.join(', ')} detected (${(productMaxConfidence * 100).toFixed(1)}%)` : `Product(s) ${productTerms.join(', ')} not detected` } : null,
            objectDetection: objectTerms.length > 0 ? { detected: objectDetected.length > 0, items: objectTerms, detectedItems: objectDetected, confidence: objectMaxConfidence, message: objectDetected.length > 0 ? `Object(s) ${objectDetected.join(', ')} detected (${(objectMaxConfidence * 100).toFixed(1)}%)` : `Object(s) ${objectTerms.join(', ')} not detected` } : null,
          } : {}),
          JSON.stringify({}), // visualSentiment not available for Google Vision
          null // visualSimilaritySummary
        );

        logger.info({ videoAnalysisId, reelUrl }, 'Saved Google Vision analysis to database');
      } catch (dbError: any) {
        logger.error({ error: dbError.message, videoAnalysisId }, 'Failed to save Google Vision analysis to database (continuing with response)');
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
            people: analysis.people,
            visualMatches: analysis.visualMatches,
          })),
          summary: {
            labels: labelSummary,
            logos: logoSummary,
            objects: objectSummary,
            brands: brandSummary,
            allText: allTexts.join(' ').trim(),
            demographicMatch,
            targetBrandDetection: allTargetTerms.length > 0 ? {
              detected: targetBrandDetected,
              confidence: targetBrandConfidence,
              message: targetBrandDetected
                ? `Target items (${allTargetTerms.join(', ')}) were detected with ${(targetBrandConfidence * 100).toFixed(1)}% confidence`
                : `Target items (${allTargetTerms.join(', ')}) were not detected in the video frames`,
            } : null,
            brandDetection: brandTerms.length > 0 ? { detected: brandDetected.length > 0, items: brandTerms, detectedItems: brandDetected, confidence: brandMaxConfidence, message: brandDetected.length > 0 ? `Brand(s) ${brandDetected.join(', ')} detected (${(brandMaxConfidence * 100).toFixed(1)}%)` : `Brand(s) ${brandTerms.join(', ')} not detected` } : null,
            productDetection: productTerms.length > 0 ? { detected: productDetected.length > 0, items: productTerms, detectedItems: productDetected, confidence: productMaxConfidence, message: productDetected.length > 0 ? `Product(s) ${productDetected.join(', ')} detected (${(productMaxConfidence * 100).toFixed(1)}%)` : `Product(s) ${productTerms.join(', ')} not detected` } : null,
            objectDetection: objectTerms.length > 0 ? { detected: objectDetected.length > 0, items: objectTerms, detectedItems: objectDetected, confidence: objectMaxConfidence, message: objectDetected.length > 0 ? `Object(s) ${objectDetected.join(', ')} detected (${(objectMaxConfidence * 100).toFixed(1)}%)` : `Object(s) ${objectTerms.join(', ')} not detected` } : null,
          },
        },
        videoAnalysisId, // Include database ID in response
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
