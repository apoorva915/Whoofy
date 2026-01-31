import { NextRequest, NextResponse } from 'next/server';
import { commentAnalysisService } from '@/services/verification/comment-analysis';
import { engagementAnalysisService } from '@/services/verification/engagement-analysis';
import logger from '@/utils/logger';
import prisma from '@/config/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/verify/engagement
 * Analyze engagement authenticity (comments and likes/views)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    
    if (!body.comments && !body.engagement) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Either comments or engagement data is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const comments = body.comments || [];
    const engagement = body.engagement;
    const followerCount = body.followerCount || null;
    const historicalEngagement = body.historicalEngagement || [];
    const reelUrl = body.reelUrl || null; // Optional: for database storage

    logger.info(
      {
        commentsCount: comments.length,
        hasEngagement: !!engagement,
        hasFollowerCount: !!followerCount,
        historicalDataPoints: historicalEngagement.length,
        reelUrl,
      },
      'Engagement verification request received'
    );

    // Analyze comments
    let commentAnalysis = null;
    if (comments.length > 0) {
      commentAnalysis = commentAnalysisService.analyzeComments(comments);
    }

    // Analyze engagement patterns
    let engagementAnalysis = null;
    if (engagement) {
      engagementAnalysis = engagementAnalysisService.analyzeEngagement(
        {
          timestamp: new Date(engagement.timestamp),
          likes: engagement.likes || 0,
          views: engagement.views || null,
          comments: engagement.comments || 0,
          shares: engagement.shares || null,
        },
        historicalEngagement.map((item: any) => ({
          timestamp: new Date(item.timestamp),
          likes: item.likes || 0,
          views: item.views || null,
          comments: item.comments || 0,
          shares: item.shares || null,
        })),
        followerCount
      );
    }

    // Overall assessment
    let overallAuthentic = true;
    let overallScore = 1.0;
    const overallIssues: string[] = [];

    if (commentAnalysis) {
      if (commentAnalysis.botLikelihood > 0.4) {
        overallAuthentic = false;
        overallScore -= 0.3;
        overallIssues.push(`High bot likelihood in comments (${(commentAnalysis.botLikelihood * 100).toFixed(1)}%)`);
      }
    }

    if (engagementAnalysis) {
      if (!engagementAnalysis.isAuthentic) {
        overallAuthentic = false;
        overallScore -= 0.3;
        overallIssues.push('Engagement authenticity concerns detected');
      }
      overallScore = Math.min(overallScore, engagementAnalysis.authenticityScore);
    }

    overallScore = Math.max(0, Math.min(1, overallScore));

    const processingTimeMs = Date.now() - startTime;

    // Save to database if reelUrl is provided
    let engagementAnalysisId: string | null = null;
    if (reelUrl) {
      try {
        engagementAnalysisId = uuidv4();
        const reelId = reelUrl.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] || null;
        const promotionTimestamp = engagement?.timestamp ? new Date(engagement.timestamp) : null;
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO aimodule.engagement_analyses (id, "reelUrl", "reelId", "overallAuthentic", "overallScore", "overallIssues", "commentAnalysis", "engagementAnalysis", "promotionTimestamp", "processingTimeMs", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, NOW())
        `,
          engagementAnalysisId,
          reelUrl,
          reelId,
          overallAuthentic,
          overallScore,
          JSON.stringify(overallIssues),
          JSON.stringify(commentAnalysis || {}),
          JSON.stringify(engagementAnalysis || {}),
          promotionTimestamp,
          processingTimeMs
        );

        logger.info({ engagementAnalysisId, reelUrl }, 'Saved engagement analysis to database');
      } catch (dbError: any) {
        logger.error({ error: dbError.message, engagementAnalysisId }, 'Failed to save engagement analysis to database (continuing with response)');
      }
    }

    const response = {
      success: true,
      data: {
        overallAuthentic,
        overallScore,
        overallIssues,
        commentAnalysis,
        engagementAnalysis,
        promotionTimestamp: engagement?.timestamp || null,
        engagementAnalysisId, // Include database ID in response
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
      'Engagement verification error'
    );
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ENGAGEMENT_VERIFICATION_ERROR',
          message: error.message || 'Failed to verify engagement',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
