import { NextRequest, NextResponse } from 'next/server';
import { nicheAnalysisService } from '@/services/detection/niche-analysis';
import logger from '@/utils/logger';
import prisma from '@/config/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/creators/niche-analysis
 * Analyze creator niche from bio and latest posts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const hasBio = !!body.bio?.trim?.();
    const hasPosts = Array.isArray(body.posts) && body.posts.length > 0;
    const hasComments = Array.isArray(body.comments) && body.comments.length > 0;
    const fi = body.frameInsights;
    const hasFrameInsights = fi && typeof fi === 'object' &&
      ((Array.isArray(fi.ocrTexts) && fi.ocrTexts.length > 0) ||
       (Array.isArray(fi.objects) && fi.objects.length > 0) ||
       (Array.isArray(fi.labels) && fi.labels.length > 0));
    const hasSuggested = Array.isArray(body.suggestedProfiles) && body.suggestedProfiles.length > 0;
    if (!hasBio && !hasPosts && !hasComments && !hasFrameInsights && !hasSuggested) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'At least one of bio, posts, comments, frameInsights, or suggestedProfiles is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const bio = body.bio || null;
    const posts = body.posts || [];
    const reelUrl = body.reelUrl || null; // Optional: for database storage
    const creatorUsername = body.creatorUsername || null; // Optional: creator username
    // Optional: comment texts from reel/post for niche context when captions are empty
    const commentsRaw = body.comments;
    const commentsSample: string[] = Array.isArray(commentsRaw)
      ? commentsRaw
          .map((c: any) => (typeof c === 'string' ? c : c?.text))
          .filter(Boolean)
          .slice(0, 50)
      : [];
    // Optional: frame-derived data (OCR, objects, labels) for niche from video/reel analysis
    const frameInsights = body.frameInsights && typeof body.frameInsights === 'object'
      ? {
          ocrTexts: Array.isArray(body.frameInsights.ocrTexts) ? body.frameInsights.ocrTexts.filter(Boolean) : undefined,
          objects: Array.isArray(body.frameInsights.objects) ? body.frameInsights.objects.filter(Boolean) : undefined,
          labels: Array.isArray(body.frameInsights.labels) ? body.frameInsights.labels.filter(Boolean) : undefined,
        }
      : undefined;
    // Optional: Instagram suggested/related profile usernames (weak signal).
    // Future: store in DB and match suggested profiles to known niches for better inference.
    const suggestedProfiles = Array.isArray(body.suggestedProfiles)
      ? body.suggestedProfiles.map((p: any) => (typeof p === 'string' ? p : p?.username)).filter(Boolean).slice(0, 20)
      : undefined;

    logger.info(
      {
        bioLength: bio?.length || 0,
        postsCount: posts.length,
        commentsCount: commentsSample.length,
        hasFrameInsights: !!frameInsights && (frameInsights.ocrTexts?.length || frameInsights.objects?.length || frameInsights.labels?.length),
        suggestedProfilesCount: suggestedProfiles?.length ?? 0,
        reelUrl,
        creatorUsername,
      },
      'Niche analysis request received'
    );

    // Analyze niche using Gemini (bio, posts, comments, frame insights, suggested profiles)
    const analysis = await nicheAnalysisService.analyzeNiche(bio, posts, {
      commentsSample: commentsSample.length > 0 ? commentsSample : undefined,
      frameInsights,
      suggestedProfiles: suggestedProfiles && suggestedProfiles.length > 0 ? suggestedProfiles : undefined,
    });

    // Save to database if reelUrl is provided
    let nicheAnalysisId: string | null = null;
    if (reelUrl) {
      try {
        nicheAnalysisId = uuidv4();
        const reelId = reelUrl.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] || null;
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO aimodule.niche_analyses (id, "reelUrl", "reelId", "creatorUsername", niches, confidence, reasoning, "processingTimeMs", "analysisProvider", "createdAt")
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, NOW())
        `,
          nicheAnalysisId,
          reelUrl,
          reelId,
          creatorUsername,
          JSON.stringify(analysis.niches),
          analysis.confidence,
          analysis.reasoning,
          analysis.processingTimeMs,
          'gemini'
        );

        logger.info({ nicheAnalysisId, reelUrl }, 'Saved niche analysis to database');
      } catch (dbError: any) {
        logger.error({ error: dbError.message, nicheAnalysisId }, 'Failed to save niche analysis to database (continuing with response)');
      }
    }

    const response = {
      success: true,
      data: {
        ...analysis,
        nicheAnalysisId, // Include database ID in response
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      'Niche analysis error'
    );
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NICHE_ANALYSIS_ERROR',
          message: error.message || 'Failed to analyze niche',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
