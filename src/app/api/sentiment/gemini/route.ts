import { NextRequest, NextResponse } from 'next/server';
import { geminiSentimentAnalysis } from '@/services/detection/gemini-sentiment-analysis';
import logger from '@/utils/logger';

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

    logger.info(
      {
        captionLength: caption?.length || 0,
        transcriptLength: transcript?.length || 0,
      },
      'Gemini sentiment analysis request received'
    );

    // Perform sentiment analysis using Gemini
    const sentimentAnalysis = await geminiSentimentAnalysis.analyzeSentiment(
      caption,
      transcript
    );

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
