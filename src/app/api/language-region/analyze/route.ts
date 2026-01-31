import { NextRequest, NextResponse } from 'next/server';
import { geminiLanguageRegionAnalysis } from '@/services/detection/gemini-language-region-analysis';
import logger from '@/utils/logger';
import prisma from '@/config/database';
import { v4 as uuidv4 } from 'uuid';

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
    const reelUrl = body.reelUrl || null; // Optional: for database storage

    logger.info(
      {
        captionLength: caption?.length || 0,
        transcriptLength: transcript?.length || 0,
        commentsCount: comments.length,
        reelUrl,
      },
      'Gemini language and region analysis request received'
    );

    // Perform language and region analysis using Gemini
    const analysis = await geminiLanguageRegionAnalysis.analyzeLanguageAndRegion(
      caption,
      transcript,
      comments
    );

    // Save to database if reelUrl is provided
    let languageRegionAnalysisId: string | null = null;
    if (reelUrl) {
      try {
        languageRegionAnalysisId = uuidv4();
        const reelId = reelUrl.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] || null;
        
        // Extract languages array from analysis
        const languagesArray = [
          ...(analysis.caption.language ? [{ language: analysis.caption.language, confidence: analysis.caption.languageConfidence }] : []),
          ...(analysis.transcript.language ? [{ language: analysis.transcript.language, confidence: analysis.transcript.languageConfidence }] : []),
          ...(analysis.comments.topLanguages || []),
        ];

        await prisma.$executeRawUnsafe(`
          INSERT INTO aimodule.language_region_analyses (id, "reelUrl", "reelId", languages, "primaryLanguage", regions, "primaryRegion", "analysisProvider", "processingTimeMs", "createdAt")
          VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9, NOW())
        `,
          languageRegionAnalysisId,
          reelUrl,
          reelId,
          JSON.stringify(languagesArray),
          analysis.caption.language || analysis.transcript.language || null,
          JSON.stringify(analysis.regions || []),
          analysis.primaryRegion?.region || null,
          'gemini',
          analysis.processingTimeMs
        );

        logger.info({ languageRegionAnalysisId, reelUrl }, 'Saved language-region analysis to database');
      } catch (dbError: any) {
        logger.error({ error: dbError.message, languageRegionAnalysisId }, 'Failed to save language-region analysis to database (continuing with response)');
      }
    }

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
        languageRegionAnalysisId, // Include database ID in response
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
