import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import logger from '@/utils/logger';
import env from '@/config/env';

/**
 * GET /api/test-gemini
 * Test endpoint to verify Gemini API key is working
 */
export async function GET(request: NextRequest) {
  try {
    // Get API key from environment variables
    const apiKey = (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
    
    if (!apiKey || apiKey.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'GEMINI_API_KEY is not set in environment variables',
        diagnostic: {
          envKeyExists: !!env.GEMINI_API_KEY,
          processEnvKeyExists: !!process.env.GEMINI_API_KEY,
        },
      }, { status: 400 });
    }

    // Log key info (masked for security)
    const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
    logger.info({
      keyLength: apiKey.length,
      maskedKey,
      startsWithAIza: apiKey.startsWith('AIza'),
    }, 'Testing Gemini API key');

    // Test the API key with a simple request
    try {
      // Use @google/genai SDK with gemini-1.5-flash (only vision model available in 2025)
      const genAI = new GoogleGenAI({ apiKey });
      
      const result = await genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'Say "Hello" in one word',
      });
      
      const text = result.text || '';

      return NextResponse.json({
        success: true,
        message: 'Gemini API key is valid and working!',
        testResponse: text.trim(),
        diagnostic: {
          keyLength: apiKey.length,
          maskedKey,
          startsWithAIza: apiKey.startsWith('AIza'),
        },
      });
    } catch (apiError: any) {
      const errorMessage = apiError.message || '';
      
      // Check for specific error types
      let errorType = 'unknown';
      let suggestions: string[] = [];

      if (errorMessage.includes('API key not valid') || errorMessage.includes('API_KEY_INVALID')) {
        errorType = 'invalid_key';
        suggestions = [
          '1. Verify your API key at https://makersuite.google.com/app/apikey',
          '2. Make sure you copied the entire key (should be ~39 characters)',
          '3. Check for any extra spaces or quotes in your .env file',
          '4. Try generating a new API key',
        ];
      } else if (errorMessage.includes('API key not found') || errorMessage.includes('404')) {
        errorType = 'key_not_found';
        suggestions = [
          '1. The API key might have been deleted',
          '2. Generate a new API key at https://makersuite.google.com/app/apikey',
        ];
      } else if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED')) {
        errorType = 'permission_denied';
        suggestions = [
          '1. Enable the Generative Language API in Google Cloud Console',
          '2. Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com',
          '3. Click "Enable" if not already enabled',
          '4. Check API key restrictions in Google Cloud Console',
        ];
      } else if (errorMessage.includes('429') || errorMessage.includes('quota')) {
        errorType = 'quota_exceeded';
        suggestions = [
          '1. You may have exceeded the free tier quota',
          '2. Wait a few minutes and try again',
          '3. Check your quota usage in Google Cloud Console',
        ];
      }

      return NextResponse.json({
        success: false,
        error: 'Gemini API test failed',
        errorType,
        errorMessage: errorMessage.substring(0, 500), // Limit error message length
        suggestions,
        diagnostic: {
          keyLength: apiKey.length,
          maskedKey,
          startsWithAIza: apiKey.startsWith('AIza'),
        },
      }, { status: 400 });
    }
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Error testing Gemini API');
    return NextResponse.json({
      success: false,
      error: 'Unexpected error testing Gemini API',
      errorMessage: error.message,
    }, { status: 500 });
  }
}

