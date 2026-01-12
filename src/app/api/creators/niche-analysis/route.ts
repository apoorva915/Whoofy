import { NextRequest, NextResponse } from 'next/server';
import { nicheAnalysisService } from '@/services/detection/niche-analysis';
import logger from '@/utils/logger';

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

    logger.info(
      {
        bioLength: bio?.length || 0,
        postsCount: posts.length,
      },
      'Niche analysis request received'
    );

    // Analyze niche using Gemini
    const analysis = await nicheAnalysisService.analyzeNiche(bio, posts);

    const response = {
      success: true,
      data: analysis,
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
