import { NextRequest, NextResponse } from 'next/server';
import { geminiSentimentAnalysis } from '@/services/detection/gemini-sentiment-analysis';
import logger from '@/utils/logger';
import prisma from '@/config/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/sentiment/gemini
 * Analyze sentiment of caption and transcript using Gemini AI
 * Accepts caption and transcript scraped by Apify
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    if (!body.caption && !body.transcript) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'At least one of caption or transcript is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const caption = body.caption || null;
    const transcript = body.transcript || null;
    const reelUrl = body.reelUrl || null; // Optional: for database storage

    logger.info(
      {
        captionLength: caption?.length || 0,
        transcriptLength: transcript?.length || 0,
        reelUrl,
      },
      'Gemini sentiment analysis request received'
    );

    // Perform sentiment analysis using Gemini
    const sentimentAnalysis = await geminiSentimentAnalysis.analyzeSentiment(
      caption,
      transcript
    );

    // Save to database if reelUrl is provided
    let sentimentAnalysisId: string | null = null;
    if (reelUrl) {
      try {
        sentimentAnalysisId = uuidv4();
        const reelId = reelUrl.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] || null;
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO aimodule.sentiment_analyses (id, "reelUrl", "reelId", "captionSentiment", "transcriptSentiment", "isPositivePublicity", "overallReasoning", "processingTimeMs", "analysisProvider", "createdAt")
          VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, NOW())
        `,
          sentimentAnalysisId,
          reelUrl,
          reelId,
          JSON.stringify({
            sentiment: sentimentAnalysis.caption.sentiment,
            confidence: sentimentAnalysis.caption.confidence,
            reasoning: sentimentAnalysis.caption.reasoning,
            language: sentimentAnalysis.caption.language,
            languageConfidence: sentimentAnalysis.caption.languageConfidence,
          }),
          JSON.stringify({
            sentiment: sentimentAnalysis.transcript.sentiment,
            confidence: sentimentAnalysis.transcript.confidence,
            reasoning: sentimentAnalysis.transcript.reasoning,
            language: sentimentAnalysis.transcript.language,
            languageConfidence: sentimentAnalysis.transcript.languageConfidence,
          }),
          sentimentAnalysis.isPositivePublicity,
          sentimentAnalysis.overallReasoning,
          sentimentAnalysis.processingTimeMs,
          'gemini'
        );

        logger.info({ sentimentAnalysisId, reelUrl }, 'Saved sentiment analysis to database');
      } catch (dbError: any) {
        logger.error({ error: dbError.message, sentimentAnalysisId }, 'Failed to save sentiment analysis to database (continuing with response)');
      }
    }

    const response = {
      success: true,
      data: {
        caption: {
          sentiment: sentimentAnalysis.caption.sentiment,
          confidence: sentimentAnalysis.caption.confidence,
          reasoning: sentimentAnalysis.caption.reasoning,
          language: sentimentAnalysis.caption.language,
          languageConfidence: sentimentAnalysis.caption.languageConfidence,
        },
        transcript: {
          sentiment: sentimentAnalysis.transcript.sentiment,
          confidence: sentimentAnalysis.transcript.confidence,
          reasoning: sentimentAnalysis.transcript.reasoning,
          language: sentimentAnalysis.transcript.language,
          languageConfidence: sentimentAnalysis.transcript.languageConfidence,
        },
        isPositivePublicity: sentimentAnalysis.isPositivePublicity,
        overallReasoning: sentimentAnalysis.overallReasoning,
        processingTimeMs: sentimentAnalysis.processingTimeMs,
        sentimentAnalysisId, // Include database ID in response
      },
      timestamp: new Date().toISOString(),
    };

    logger.info(
      {
        captionSentiment: sentimentAnalysis.caption.sentiment,
        transcriptSentiment: sentimentAnalysis.transcript.sentiment,
        isPositivePublicity: sentimentAnalysis.isPositivePublicity,
        processingTimeMs: sentimentAnalysis.processingTimeMs,
      },
      'Gemini sentiment analysis completed successfully'
    );

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      'Gemini sentiment analysis error'
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SENTIMENT_ANALYSIS_ERROR',
          message: error.message || 'Failed to analyze sentiment',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
