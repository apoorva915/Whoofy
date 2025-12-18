import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import logger from '@/utils/logger';
import env from '@/config/env';

/**
 * GET /api/health/gemini
 * Health check endpoint to verify Gemini API is properly configured and working
 */
export async function GET(request: NextRequest) {
  try {
    // TEMPORARY: Hardcoded API key for testing (same as frame-analyzer)
    const hardcodedKey = 'AIzaSyC5jlHZjdymFIJfJdId-DaeqfHvQ8AVPQk';
    
    // Check API key availability
    const envKey = env.GEMINI_API_KEY?.trim() || '';
    const processKey = process.env.GEMINI_API_KEY?.trim() || '';
    const apiKey = hardcodedKey || envKey || processKey;

    const diagnostics = {
      hardcodedKeyExists: !!hardcodedKey,
      envKeyExists: !!envKey,
      envKeyLength: envKey.length,
      processKeyExists: !!processKey,
      processKeyLength: processKey.length,
      finalApiKeyExists: !!apiKey,
      finalApiKeyLength: apiKey?.length || 0,
      finalApiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'NONE',
    };

    if (!apiKey || apiKey.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: 'No API key found',
        diagnostics,
      }, { status: 400 });
    }

    // Try to initialize and make a test call
    try {
      logger.info('Testing Gemini API initialization', diagnostics);
      // Use @google/genai SDK with gemini-1.5-flash (only vision model available in 2025)
      const genAI = new GoogleGenAI({ apiKey });
      
      const result = await genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'Say "Hello" in one word',
      });
      
      const text = result.text || '';

      return NextResponse.json({
        status: 'healthy',
        message: 'Gemini API is working correctly',
        testResponse: text.trim(),
        diagnostics: {
          ...diagnostics,
          modelInitialized: true,
          apiCallSuccessful: true,
        },
      });
    } catch (apiError: any) {
      logger.error({
        error: apiError.message,
        stack: apiError.stack,
      }, 'Gemini API test failed');

      return NextResponse.json({
        status: 'error',
        message: 'Gemini API initialization or call failed',
        error: apiError.message,
        diagnostics: {
          ...diagnostics,
          modelInitialized: false,
          apiCallSuccessful: false,
        },
      }, { status: 500 });
    }
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Health check error');
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
    }, { status: 500 });
  }
}

