import { NextRequest, NextResponse } from 'next/server';
import { commentAnalysisService } from '@/services/verification/comment-analysis';
import { engagementAnalysisService } from '@/services/verification/engagement-analysis';
import logger from '@/utils/logger';

/**
 * POST /api/verify/engagement
 * Analyze engagement authenticity (comments and likes/views)
 */
export async function POST(request: NextRequest) {
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

    logger.info(
      {
        commentsCount: comments.length,
        hasEngagement: !!engagement,
        hasFollowerCount: !!followerCount,
        historicalDataPoints: historicalEngagement.length,
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

    const response = {
      success: true,
      data: {
        overallAuthentic,
        overallScore,
        overallIssues,
        commentAnalysis,
        engagementAnalysis,
        promotionTimestamp: engagement?.timestamp || null,
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
