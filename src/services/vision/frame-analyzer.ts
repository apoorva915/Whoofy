import fs from 'fs-extra';
import path from 'path';
import logger from '@/utils/logger';
import { FrameAnalysis, VisualSummary, VisionAnalysisResult } from '@/types/vision';
import { visionModel } from '@/lib/ai/vision-model';

interface AnalyzeOptions {
  frameInterval?: number;
  targetBrandName?: string;
  productNames?: string[]; // Optional array of product names to detect
  videoDuration?: number;
  videoId?: string;
}

/**
 * Frame Analyzer
 * Sends extracted frames to Gemini, aggregates results, and persists JSON
 */
class FrameAnalyzer {
  /**
   * Analyze a list of frames and build a visual summary
   */
  async analyzeFrames(
    frames: string[],
    options: AnalyzeOptions = {}
  ): Promise<VisionAnalysisResult> {
    const {
      frameInterval = 1,
      targetBrandName = 'Cadbury Dairy Milk',
      productNames = [],
      videoDuration,
      videoId,
    } = options;

    const frameAnalyses: FrameAnalysis[] = [];

    for (let i = 0; i < frames.length; i++) {
      const framePath = frames[i];
      const timestamp = Number((i * frameInterval).toFixed(2));

      // Skip mock frames
      if (framePath.startsWith('mock://')) {
        frameAnalyses.push({
          timestamp,
          objects: [],
          brands: [],
        });
        continue;
      }

      try {
        const analysis = await visionModel.analyzeFrame(
          framePath,
          timestamp,
          targetBrandName,
          productNames
        );
        frameAnalyses.push(analysis);
      } catch (error: any) {
        logger.error(
          {
            error: error?.message,
            framePath,
            timestamp,
          },
          'Frame analysis failed'
        );
        frameAnalyses.push({
          timestamp,
          objects: [],
          brands: [],
        });
      }
    }

    const visualSummary = this.buildVisualSummary(
      frameAnalyses,
      frameInterval,
      videoDuration,
      targetBrandName,
      productNames
    );

    // Log visual similarity summary if available
    if (visualSummary.visualSimilaritySummary) {
      const vs = visualSummary.visualSimilaritySummary;
      logger.info({
        averageSimilarity: vs.averageSimilarity,
        maxSimilarity: vs.maxSimilarity,
        matchedFrames: vs.matchedFrames,
        totalFrames: vs.totalFrames,
        visibleSeconds: vs.visibleSeconds,
      }, `CLIP Visual Similarity Summary: ${vs.matchedFrames}/${vs.totalFrames} frames matched (avg: ${vs.averageSimilarity.toFixed(3)}, max: ${vs.maxSimilarity.toFixed(3)})`);
    } else {
      const framesWithSimilarity = frameAnalyses.filter(f => f.visualSimilarity).length;
      if (framesWithSimilarity === 0) {
        logger.info('CLIP visual similarity not available - no reference image provided or CLIP dependencies not installed');
      }
    }

    const storagePath = await this.persistAnalysis(videoId, {
      frameAnalyses,
      visualSummary,
    });

    return {
      frameAnalyses,
      visualSummary: {
        ...visualSummary,
        frameAnalyses,
      },
      storagePath,
    };
  }

  /**
   * Build aggregated summary across frames with brand confirmation and visual sentiment
   */
  private buildVisualSummary(
    analyses: FrameAnalysis[],
    frameInterval: number,
    videoDuration: number | undefined,
    targetBrandName: string,
    productNames: string[] = []
  ): VisualSummary {
    const objectSet = new Set<string>();
    const brandMap = new Map<
      string,
      { confidenceSum: number; count: number; totalFrames: number }
    >();

    // Collect all objects and brands
    analyses.forEach((analysis) => {
      analysis.objects.forEach((obj) => objectSet.add(obj));

      analysis.brands.forEach((brand) => {
        const key = brand.name.trim();
        if (!key) return;
        const existing = brandMap.get(key) || {
          confidenceSum: 0,
          count: 0,
          totalFrames: 0,
        };
        existing.confidenceSum += brand.confidence || 0;
        existing.count += 1;
        existing.totalFrames += 1;
        brandMap.set(key, existing);
      });
    });

    const brandsDetected = Array.from(brandMap.entries()).map(([name, data]) => {
      const avgConfidence = data.count ? data.confidenceSum / data.count : 0;
      const visibleSeconds = data.totalFrames * frameInterval;
      const clampedSeconds =
        videoDuration != null
          ? Math.min(videoDuration, visibleSeconds)
          : visibleSeconds;

      return {
        name,
        confidence: Number(avgConfidence.toFixed(3)),
        totalFrames: data.totalFrames,
        totalVisibleSeconds: Number(clampedSeconds.toFixed(2)),
      };
    });

    // Brand Confirmation: Check if target brand/product was detected
    const targetBrandConfirmation = this.buildBrandConfirmation(
      brandsDetected,
      analyses,
      targetBrandName,
      productNames,
      frameInterval,
      videoDuration
    );

    // Visual Sentiment: Analyze if the reel gives positive/negative publicity
    const visualSentiment = this.analyzeVisualSentiment(
      analyses,
      targetBrandName,
      productNames,
      Array.from(objectSet)
    );

    // Visual Similarity Summary: Aggregate CLIP similarity results
    const visualSimilaritySummary = this.buildVisualSimilaritySummary(
      analyses,
      frameInterval,
      videoDuration
    );

    return {
      uniqueObjects: Array.from(objectSet),
      brandsDetected,
      targetBrandConfirmation,
      visualSentiment,
      visualSimilaritySummary,
      frameAnalyses: analyses,
    };
  }

  /**
   * Build visual similarity summary from CLIP results
   */
  private buildVisualSimilaritySummary(
    analyses: FrameAnalysis[],
    frameInterval: number,
    videoDuration: number | undefined
  ): VisualSummary['visualSimilaritySummary'] {
    const similarities = analyses
      .map(a => a.visualSimilarity)
      .filter((vs): vs is NonNullable<typeof vs> => vs !== undefined);

    if (similarities.length === 0) {
      return undefined;
    }

    const similarityScores = similarities.map(vs => vs.similarity);
    const averageSimilarity = similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length;
    const maxSimilarity = Math.max(...similarityScores);
    const matchedFrames = similarities.filter(vs => vs.match).length;
    const totalFrames = similarities.length;
    const visibleSeconds = matchedFrames * frameInterval;
    const clampedSeconds = videoDuration != null
      ? Math.min(videoDuration, visibleSeconds)
      : visibleSeconds;

    return {
      averageSimilarity: Number(averageSimilarity.toFixed(3)),
      maxSimilarity: Number(maxSimilarity.toFixed(3)),
      matchedFrames,
      totalFrames,
      visibleSeconds: Number(clampedSeconds.toFixed(2)),
    };
  }

  /**
   * Build brand confirmation - explicitly states if target brand/product was detected
   */
  private buildBrandConfirmation(
    brandsDetected: Array<{ name: string; confidence: number; totalFrames: number; totalVisibleSeconds?: number }>,
    analyses: FrameAnalysis[],
    targetBrandName: string,
    productNames: string[],
    frameInterval: number,
    videoDuration?: number
  ): VisualSummary['targetBrandConfirmation'] {
    // Parse brand and products from target brand name
    // Handle comma-separated brand names (e.g., "garnier, garnieruk")
    const brandString = targetBrandName.trim();
    const allBrandNames: string[] = [];
    
    if (brandString.includes(',')) {
      // Split by comma and treat each as a separate brand
      const brandParts = brandString.split(',').map(b => b.trim()).filter(b => b.length > 0);
      allBrandNames.push(...brandParts);
    } else {
      // Single brand name - extract brand name (typically the first word)
      const brandParts = brandString.split(/\s+/);
      allBrandNames.push(brandParts[0] || brandString);
    }
    
    const brandName = allBrandNames[0] || targetBrandName;
    const allTargetTerms = [
      ...allBrandNames.map(b => b.toLowerCase()),
      brandName.toLowerCase(),
      targetBrandName.toLowerCase(),
      ...productNames.map(p => p.toLowerCase()),
    ];

    // Check if any target brand/product was detected
    let detectedBrand: { name: string; confidence: number; totalFrames: number; totalVisibleSeconds?: number } | null = null;
    let detectedInFrames = 0;
    let maxConfidence = 0;

    // Check exact matches first
    for (const term of allTargetTerms) {
      const match = brandsDetected.find(
        b => b.name.toLowerCase() === term
      );
      if (match && match.confidence > maxConfidence) {
        detectedBrand = match;
        maxConfidence = match.confidence;
        detectedInFrames = match.totalFrames;
      }
    }

    // Check partial matches (e.g., "Dairy Milk" matches "Cadbury Dairy Milk")
    if (!detectedBrand) {
      for (const term of allTargetTerms) {
        const match = brandsDetected.find(
          b => b.name.toLowerCase().includes(term) || term.includes(b.name.toLowerCase())
        );
        if (match && match.confidence > maxConfidence) {
          detectedBrand = match;
          maxConfidence = match.confidence;
          detectedInFrames = match.totalFrames;
        }
      }
    }

    // Count frames where target brand was detected
    if (!detectedBrand) {
      analyses.forEach((analysis) => {
        const hasTargetBrand = analysis.brands.some((brand) => {
          const brandLower = brand.name.toLowerCase();
          return allTargetTerms.some(
            term => brandLower === term || brandLower.includes(term) || term.includes(brandLower)
          );
        });
        if (hasTargetBrand) {
          detectedInFrames++;
        }
      });
    }

    const detected = detectedBrand !== null || detectedInFrames > 0;
    const visibleSeconds = detectedInFrames * frameInterval;
    const clampedSeconds = videoDuration != null
      ? Math.min(videoDuration, visibleSeconds)
      : visibleSeconds;

    // Build confirmation message - clear and direct
    let message: string;
    if (detected) {
      const brandDisplayName = detectedBrand?.name || targetBrandName;
      // Use simple, direct confirmation: "Yes, it shows [Brand/Product]"
      if (detectedInFrames === 1) {
        message = `Yes, it shows ${brandDisplayName} (detected in 1 frame).`;
      } else {
        message = `Yes, it shows ${brandDisplayName} (detected in ${detectedInFrames} frames, visible for ${clampedSeconds.toFixed(1)}s).`;
      }
    } else {
      message = `No, ${targetBrandName} was not detected in the video frames.`;
    }

    return {
      detected,
      message,
      confidence: detectedBrand ? detectedBrand.confidence : (detectedInFrames > 0 ? 0.6 : 0),
      detectedInFrames,
      totalVisibleSeconds: detected ? Number(clampedSeconds.toFixed(2)) : 0,
    };
  }

  /**
   * Analyze visual sentiment - determines if reel gives positive/negative publicity
   */
  private analyzeVisualSentiment(
    analyses: FrameAnalysis[],
    targetBrandName: string,
    productNames: string[],
    allObjects: string[]
  ): VisualSummary['visualSentiment'] {
    let positiveScore = 0;
    let negativeScore = 0;
    const reasoningParts: string[] = [];

    // Positive indicators
    const positiveObjects = ['person', 'smile', 'happy', 'food', 'chocolate', 'candy', 'snack'];
    const positiveKeywords = ['love', 'amazing', 'best', 'great', 'delicious', 'yummy', 'tasty', 'recommend'];

    // Negative indicators
    const negativeObjects = ['trash', 'garbage', 'waste', 'broken', 'damaged'];
    const negativeKeywords = ['hate', 'bad', 'worst', 'disgusting', 'awful', 'terrible', 'don\'t buy', 'avoid'];

    // Check if target brand is present
    const targetBrandParts = targetBrandName.toLowerCase().split(/\s+/);
    const brandName = targetBrandParts[0];
    let brandPresent = false;
    let brandFrames = 0;

    analyses.forEach((analysis) => {
      // Check if target brand is in this frame
      const hasTargetBrand = analysis.brands.some((brand) => {
        const brandLower = brand.name.toLowerCase();
        return brandLower === brandName || 
               brandLower.includes(brandName) || 
               brandName.includes(brandLower) ||
               productNames.some(p => brandLower.includes(p.toLowerCase()));
      });

      if (hasTargetBrand) {
        brandPresent = true;
        brandFrames++;
      }

      // Analyze objects in frame
      analysis.objects.forEach((obj) => {
        const objLower = obj.toLowerCase();
        if (positiveObjects.some(p => objLower.includes(p))) {
          positiveScore += 0.1;
        }
        if (negativeObjects.some(n => objLower.includes(n))) {
          negativeScore += 0.2;
        }
      });
    });

    // Brand presence is positive (showing the product)
    if (brandPresent) {
      positiveScore += 0.4; // Strong positive indicator
      reasoningParts.push(`Target brand "${targetBrandName}" is prominently shown in ${brandFrames} frames`);
    } else {
      negativeScore += 0.1; // Less negative - brand might be there but not detected
      reasoningParts.push(`Target brand "${targetBrandName}" is not clearly visible in frames`);
    }

    // Object analysis
    const hasPositiveObjects = allObjects.some(obj => 
      positiveObjects.some(p => obj.toLowerCase().includes(p))
    );
    const hasNegativeObjects = allObjects.some(obj => 
      negativeObjects.some(n => obj.toLowerCase().includes(n))
    );

    if (hasPositiveObjects) {
      positiveScore += 0.2;
      reasoningParts.push('Positive visual elements detected (person, food, product)');
    }
    if (hasNegativeObjects) {
      negativeScore += 0.3;
      reasoningParts.push('Negative visual elements detected (trash, damage)');
    }

    // Calculate final sentiment
    const totalScore = positiveScore - negativeScore;
    const normalizedScore = Math.max(-1, Math.min(1, totalScore / Math.max(1, analyses.length * 0.1)));

    let sentiment: 'positive' | 'negative' | 'neutral';
    if (normalizedScore > 0.2) {
      sentiment = 'positive';
    } else if (normalizedScore < -0.2) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    // Build reasoning
    let reasoning = reasoningParts.join('. ');
    if (reasoningParts.length === 0) {
      reasoning = 'Limited visual indicators found.';
    }

    // Add sentiment conclusion with clear statement
    if (sentiment === 'positive') {
      reasoning += ` Overall, this reel provides POSITIVE publicity for ${targetBrandName} - the brand/product is shown favorably with positive visual elements.`;
    } else if (sentiment === 'negative') {
      reasoning += ` Overall, this reel provides NEGATIVE publicity for ${targetBrandName} - negative visual elements or poor brand presentation detected.`;
    } else {
      reasoning += ` Overall, this reel provides NEUTRAL publicity for ${targetBrandName} - neither strongly positive nor negative visual indicators.`;
    }

    // Calculate confidence based on how clear the indicators are
    const confidence = Math.min(0.95, Math.max(0.5, Math.abs(normalizedScore) * 0.8 + 0.2));

    return {
      sentiment,
      score: Number(normalizedScore.toFixed(3)),
      reasoning,
      confidence: Number(confidence.toFixed(3)),
    };
  }

  /**
   * Persist analysis to storage/analyses for debugging
   */
  private async persistAnalysis(
    videoId: string | undefined,
    payload: { frameAnalyses: FrameAnalysis[]; visualSummary: VisualSummary }
  ): Promise<string | undefined> {
    if (!videoId) return undefined;

    try {
      const analysesDir = path.join(process.cwd(), 'storage', 'analyses');
      await fs.ensureDir(analysesDir);
      const filePath = path.join(analysesDir, `${videoId}-vision.json`);
      await fs.writeJson(
        filePath,
        {
          videoId,
          generatedAt: new Date().toISOString(),
          frameCount: payload.frameAnalyses.length,
          payload,
        },
        { spaces: 2 }
      );
      return filePath;
    } catch (error: any) {
      logger.warn(
        {
          error: error?.message,
          videoId,
        },
        'Failed to persist vision analysis'
      );
      return undefined;
    }
  }
}

export const frameAnalyzer = new FrameAnalyzer();






