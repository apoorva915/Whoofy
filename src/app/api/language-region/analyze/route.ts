import { NextRequest, NextResponse } from 'next/server';
import { geminiLanguageRegionAnalysis } from '@/services/detection/gemini-language-region-analysis';
import logger from '@/utils/logger';

/**
 * POST /api/language-region/analyze
 * Analyze language and region from caption, transcript, and comments using Gemini AI
 * Accepts caption, transcript, and comments scraped by Apify
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const caption = body.caption || null;
    const transcript = body.transcript || null;
    const comments = Array.isArray(body.comments) ? body.comments : [];

    logger.info(
      {
        captionLength: caption?.length || 0,
        transcriptLength: transcript?.length || 0,
        commentsCount: comments.length,
      },
      'Gemini language and region analysis request received'
    );

    // Perform language and region analysis using Gemini
    const analysis = await geminiLanguageRegionAnalysis.analyzeLanguageAndRegion(
      caption,
      transcript,
      comments
    );

    const response = {
      success: true,
      data: {
        caption: {
          language: analysis.caption.language,
          languageConfidence: analysis.caption.languageConfidence,
        },
        transcript: {
          language: analysis.transcript.language,
          languageConfidence: analysis.transcript.languageConfidence,
        },
        comments: {
          totalAnalyzed: analysis.comments.totalAnalyzed,
          languageDistribution: analysis.comments.languageDistribution,
          topLanguages: analysis.comments.topLanguages,
        },
        regions: analysis.regions,
        primaryRegion: analysis.primaryRegion,
        processingTimeMs: analysis.processingTimeMs,
      },
      timestamp: new Date().toISOString(),
    };

    logger.info(
      {
        captionLanguage: analysis.caption.language,
        transcriptLanguage: analysis.transcript.language,
        commentsAnalyzed: analysis.comments.totalAnalyzed,
        primaryRegion: analysis.primaryRegion?.region,
        processingTimeMs: analysis.processingTimeMs,
      },
      'Gemini language and region analysis completed successfully'
    );

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      'Gemini language and region analysis error'
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LANGUAGE_REGION_ANALYSIS_ERROR',
          message: error.message || 'Failed to analyze language and region',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
