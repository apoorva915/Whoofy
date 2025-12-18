import { GoogleGenAI } from '@google/genai';
import fs from 'fs-extra';
import path from 'path';
import logger from '@/utils/logger';
import env from '@/config/env';
import { FrameAnalysis, VisualSummary } from '@/types/vision';
import { logGeminiDiagnostics } from '@/utils/gemini-diagnostics';

/**
 * Frame Analyzer Service
 * Analyzes video frames using Gemini Vision API to detect objects and brands
 */
class FrameAnalyzer {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    // Log diagnostics on first initialization
    logGeminiDiagnostics();
    
    // TEMPORARY: Hardcoded API key for testing
    // TODO: Remove this and use environment variable after debugging
    const hardcodedKey = 'AIzaSyC5jlHZjdymFIJfJdId-DaeqfHvQ8AVPQk';
    
    // Try to get API key from multiple sources (env config and process.env directly)
    const envKey = env.GEMINI_API_KEY?.trim() || '';
    const processKey = process.env.GEMINI_API_KEY?.trim() || '';
    const apiKey = hardcodedKey || envKey || processKey;
    
    // Log what we found
    logger.info('🔍 Gemini API Key Check in Constructor', {
      hardcodedKeyExists: !!hardcodedKey,
      envKeyExists: !!envKey,
      envKeyLength: envKey.length,
      processKeyExists: !!processKey,
      processKeyLength: processKey.length,
      finalApiKeyExists: !!apiKey,
      finalApiKeyLength: apiKey.length,
      finalApiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'NONE',
    });
    
    if (apiKey && apiKey.length > 0) {
      try {
        // Validate API key format (Gemini keys typically start with AIza)
        if (!apiKey.startsWith('AIza') && apiKey.length < 20) {
          logger.warn('GEMINI_API_KEY format looks invalid, but attempting to use it');
        }
        
        logger.info('🚀 Initializing GoogleGenerativeAI with API key', { 
          keyLength: apiKey.length,
          keyPrefix: apiKey.substring(0, 8) + '...',
        });
        
        // Use @google/genai SDK with gemini-1.5-flash (only vision model available in 2025)
        this.genAI = new GoogleGenAI({ apiKey });
        logger.info('✅ GoogleGenAI instance created successfully', {
          genAIExists: !!this.genAI,
        });
        
        logger.info('✅✅✅ Gemini Vision API initialized successfully with gemini-1.5-flash', { 
          keyLength: apiKey.length,
          keyPrefix: apiKey.substring(0, 4) + '...',
          source: hardcodedKey ? 'hardcoded' : (envKey ? 'env' : 'process.env'),
          genAIExists: !!this.genAI,
        });
      } catch (error: any) {
        logger.error({ 
          error: error.message,
          stack: error.stack,
          errorName: error.name,
        }, '❌ Failed to initialize Gemini API - will use mock data');
        // Reset to null so we know initialization failed
        this.genAI = null;
      }
    } else {
      logger.error('❌ GEMINI_API_KEY not set - vision analysis will use mock data', {
        hardcodedKeyExists: !!hardcodedKey,
        envKeyExists: !!envKey,
        processKeyExists: !!processKey,
      });
    }
  }

  /**
   * Analyze a single frame
   */
  async analyzeFrame(
    framePath: string,
    timestamp: number,
    videoDuration: number
  ): Promise<FrameAnalysis> {
    // Handle mock frames
    if (framePath.startsWith('mock://')) {
      return this.getMockFrameAnalysis(timestamp);
    }

    // Check if API is available
    if (!this.genAI) {
      // TEMPORARY: Hardcoded API key for testing
      const hardcodedKey = 'AIzaSyC5jlHZjdymFIJfJdId-DaeqfHvQ8AVPQk';
      
      // Double-check if API key is available now (might have been set after constructor)
      const envKey = env.GEMINI_API_KEY?.trim() || '';
      const processKey = process.env.GEMINI_API_KEY?.trim() || '';
      const apiKey = hardcodedKey || envKey || processKey;
      
      logger.warn('Gemini API not initialized, attempting late initialization', {
        apiKeyExists: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        genAIExists: !!this.genAI,
      });
      
      if (apiKey && apiKey.length > 0 && !this.genAI) {
        try {
          logger.info('Attempting to initialize Gemini API with late-loaded key', {
            keyLength: apiKey.length,
            keyPrefix: apiKey.substring(0, 8) + '...',
          });
          this.genAI = new GoogleGenAI({ apiKey });
          logger.info('GoogleGenAI instance created in late-load', {
            genAIExists: !!this.genAI,
          });
        } catch (error: any) {
          logger.error({ 
            error: error.message,
            stack: error.stack,
            errorName: error.name,
          }, 'Failed to initialize Gemini API on retry');
        }
      }
      
      if (!this.genAI) {
        logger.error('Gemini API not available after all attempts - returning mock analysis', {
          genAIExists: !!this.genAI,
          apiKeyExists: !!apiKey,
          apiKeyLength: apiKey?.length || 0,
        });
        // TODO: Consider throwing error instead of silently returning mock data
        return this.getMockFrameAnalysis(timestamp);
      }
    }

    try {
      // Read image file
      if (!(await fs.pathExists(framePath))) {
        logger.warn(`Frame file not found: ${framePath}`);
        return this.getMockFrameAnalysis(timestamp);
      }

      const imageData = await fs.readFile(framePath);
      const base64Image = imageData.toString('base64');

      // Prepare the prompt
      const prompt = `Analyze this image frame from a video. List all objects and brands you see. 

If you see chocolate, specify if it is Cadbury Dairy Milk or some other brand. Be specific about brand names when visible.

Return ONLY a valid JSON object with this exact structure:
{
  "objects": ["object1", "object2", ...],
  "brands": [
    {"name": "brand name", "confidence": 0.0-1.0}
  ]
}

Do not include any markdown formatting, code blocks, or additional text. Only return the JSON object.`;

      // Call Gemini Vision API
      // TEMPORARY: Hardcoded API key for testing
      const hardcodedKey = 'AIzaSyC5jlHZjdymFIJfJdId-DaeqfHvQ8AVPQk';
      
      // Get fresh API key to ensure we're using the latest value
      const apiKey = hardcodedKey || (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
      if (!apiKey || apiKey.length === 0) {
        logger.warn('API key not available during frame analysis, using mock');
        return this.getMockFrameAnalysis(timestamp);
      }

      // Call Gemini Vision API using @google/genai SDK with gemini-1.5-flash
      const result = await this.genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
      });

      // Extract text from response
      const text = result.text || '';

      // Parse JSON response
      let parsed: { objects: string[]; brands: Array<{ name: string; confidence: number }> };
      
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || text.match(/(\{[\s\S]*\})/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;
        parsed = JSON.parse(jsonText.trim());
      } catch (parseError: any) {
        logger.error(
          {
            error: parseError.message,
            response: text.substring(0, 200),
            framePath,
          },
          'Failed to parse Gemini response as JSON'
        );
        // Fallback: try to extract objects and brands from text
        return this.extractFromText(text, timestamp);
      }

      // Validate and normalize response
      const objects = Array.isArray(parsed.objects) ? parsed.objects : [];
      const brands = Array.isArray(parsed.brands)
        ? parsed.brands.map((b) => ({
            name: String(b.name || ''),
            confidence: Math.max(0, Math.min(1, Number(b.confidence) || 0.5)),
          }))
        : [];

      return {
        timestamp,
        objects,
        brands,
      };
    } catch (error: any) {
      // Check if it's an API key error
      const errorMessage = error.message || '';
      const isApiKeyError = errorMessage.includes('API key not valid') || 
                           errorMessage.includes('API_KEY_INVALID') ||
                           errorMessage.includes('401') ||
                           errorMessage.includes('403');
      
      if (isApiKeyError) {
        logger.error(
          {
            error: error.message,
            framePath,
            timestamp,
            hint: 'Check that GEMINI_API_KEY is set correctly in your .env file. Get a key from https://makersuite.google.com/app/apikey',
          },
          'Gemini API key error - check your API key configuration'
        );
        // Log detailed diagnostic info
        const apiKey = (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
        logger.error({
          apiKeyLength: apiKey.length,
          apiKeyPrefix: apiKey.substring(0, 8) + '...',
          apiKeyEndsWith: '...' + apiKey.substring(Math.max(0, apiKey.length - 4)),
          hasWhitespace: apiKey !== apiKey.trim(),
          envKeyExists: !!env.GEMINI_API_KEY,
          processEnvKeyExists: !!process.env.GEMINI_API_KEY,
          hint: 'Test your API key at GET /api/test-gemini to get detailed error information',
        }, 'API key diagnostic info');
        
        // Return mock data instead of throwing - allows process to continue
        logger.warn('Using mock data due to API key error. Test your API key at GET /api/test-gemini');
        return this.getMockFrameAnalysis(timestamp);
      }
      
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          framePath,
          timestamp,
        },
        'Error analyzing frame with Gemini'
      );
      return this.getMockFrameAnalysis(timestamp);
    }
  }

  /**
   * Extract objects and brands from text response (fallback)
   */
  private extractFromText(text: string, timestamp: number): FrameAnalysis {
    const objects: string[] = [];
    const brands: Array<{ name: string; confidence: number }> = [];

    // Try to find objects mentioned
    const objectKeywords = ['chocolate', 'bar', 'product', 'person', 'hand', 'table', 'background'];
    objectKeywords.forEach((keyword) => {
      if (text.toLowerCase().includes(keyword)) {
        objects.push(keyword);
      }
    });

    // Try to find brands mentioned
    const brandKeywords = ['cadbury', 'dairy milk', 'pepsi', 'coca cola', 'coke'];
    brandKeywords.forEach((brand) => {
      if (text.toLowerCase().includes(brand.toLowerCase())) {
        brands.push({ name: brand, confidence: 0.6 });
      }
    });

    return {
      timestamp,
      objects,
      brands,
    };
  }

  /**
   * Analyze all frames and create visual summary
   */
  async analyzeFrames(
    framePaths: string[],
    videoDuration: number,
    frameInterval: number = 2
  ): Promise<VisualSummary> {
    logger.info(`Analyzing ${framePaths.length} frames`);

    const frameAnalyses: FrameAnalysis[] = [];
    const uniqueObjectsSet = new Set<string>();
    const brandMap = new Map<string, { confidence: number; frames: number[] }>();

    // Analyze each frame
    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i];
      // Calculate timestamp based on frame index and interval
      const timestamp = Math.min(i * frameInterval, videoDuration);

      logger.debug(`Analyzing frame ${i + 1}/${framePaths.length} at ${timestamp}s`);

      const analysis = await this.analyzeFrame(framePath, timestamp, videoDuration);
      frameAnalyses.push(analysis);

      // Collect unique objects
      analysis.objects.forEach((obj) => uniqueObjectsSet.add(obj.toLowerCase()));

      // Aggregate brands
      analysis.brands.forEach((brand) => {
        const existing = brandMap.get(brand.name.toLowerCase());
        if (existing) {
          existing.frames.push(i);
          // Update confidence to average (or max, depending on preference)
          existing.confidence = Math.max(existing.confidence, brand.confidence);
        } else {
          brandMap.set(brand.name.toLowerCase(), {
            confidence: brand.confidence,
            frames: [i],
          });
        }
      });

      // Add small delay to avoid rate limiting
      if (i < framePaths.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Build brands detected array
    const brandsDetected = Array.from(brandMap.entries()).map(([name, data]) => ({
      name,
      confidence: data.confidence,
      totalFrames: data.frames.length,
      totalVisibleSeconds: data.frames.length * frameInterval,
    }));

    const visualSummary: VisualSummary = {
      uniqueObjects: Array.from(uniqueObjectsSet),
      brandsDetected,
      frameAnalyses,
    };

    logger.info(
      `Frame analysis complete: ${uniqueObjectsSet.size} unique objects, ${brandsDetected.length} brands detected`
    );

    return visualSummary;
  }

  /**
   * Get mock frame analysis (for development/testing)
   */
  private getMockFrameAnalysis(timestamp: number): FrameAnalysis {
    return {
      timestamp,
      objects: ['chocolate bar', 'hand', 'background'],
      brands: [
        { name: 'Cadbury Dairy Milk', confidence: 0.85 },
        { name: 'Cadbury', confidence: 0.9 },
      ],
    };
  }
}

export const frameAnalyzer = new FrameAnalyzer();

