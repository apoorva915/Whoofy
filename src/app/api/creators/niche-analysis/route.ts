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
    
    if (!body.bio && (!body.posts || !Array.isArray(body.posts) || body.posts.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Either bio or posts array is required',
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

    logger.info(
      {
        bioLength: bio?.length || 0,
        postsCount: posts.length,
        reelUrl,
        creatorUsername,
      },
      'Niche analysis request received'
    );

    // Analyze niche using Gemini
    const analysis = await nicheAnalysisService.analyzeNiche(bio, posts);

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
