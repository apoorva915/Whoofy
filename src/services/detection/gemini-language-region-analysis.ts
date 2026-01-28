// Service for analyzing language and region from comments using Google Gemini
// Analyzes top comments to detect languages and determine geographic regions

import { GoogleGenAI } from '@google/genai';
import { externalApiConfig, isApiConfigured } from '@/config/external-apis';
import logger from '@/utils/logger';

/**
 * Comment Language Detection Result
 */
export interface CommentLanguageResult {
  text: string;
  language: string; // ISO 639-1 language code
  languageConfidence: number; // 0-1
}

/**
 * Language and Region Analysis Result from Gemini
 */
export interface GeminiLanguageRegionAnalysisResult {
  caption: {
    language: string;
    languageConfidence?: number;
  };
  transcript: {
    language: string;
    languageConfidence?: number;
  };
  comments: {
    totalAnalyzed: number;
    languageDistribution: Array<{
      language: string;
      languageName: string;
      count: number;
      percentage: number;
      examples: string[];
    }>;
    topLanguages: Array<{
      language: string;
      languageName: string;
      count: number;
      percentage: number;
    }>;
  };
  regions: Array<{
    region: string;
    country?: string;
    confidence: number;
    reasoning: string;
    primaryLanguages: string[];
    languagePercentage: number;
  }>;
  primaryRegion: {
    region: string;
    country?: string;
    confidence: number;
    reasoning: string;
  } | null;
  processingTimeMs: number;
}

/**
 * Gemini Language and Region Analysis Service
 */
class GeminiLanguageRegionAnalysisService {
  private client: GoogleGenAI | null = null;
  private modelName: string = 'gemini-2.5-flash';

  constructor() {
    if (isApiConfigured('gemini')) {
      const apiKey = externalApiConfig.gemini.apiKey;
      const model = externalApiConfig.gemini.model || 'gemini-2.5-flash';
      
      if (apiKey) {
        try {
          this.client = new GoogleGenAI({ apiKey });
          this.modelName = model;
          logger.info({ model }, 'Gemini language and region analysis service initialized');
        } catch (error: any) {
          logger.error({ error: error?.message }, 'Failed to initialize Gemini client');
        }
      }
    } else {
      logger.warn('Gemini API key not configured - language and region analysis will use fallback');
    }
  }

  /**
   * Check if Gemini is configured and available
   */
  isConfigured(): boolean {
    return this.client !== null && isApiConfigured('gemini');
  }

  /**
   * Comprehensive prompt for language and region analysis
   */
  private getLanguageRegionAnalysisPrompt(
    caption: string | null,
    transcript: string | null,
    comments: Array<{ text: string }>
  ): string {
    const commentsText = comments.length > 0
      ? comments.map((c, idx) => `${idx + 1}. "${c.text}"`).join('\n')
      : '(No comments provided)';

    return `You are an expert language and geographic region detection system specializing in social media content analysis. Your task is to analyze the language of caption, transcript, and top comments, then determine the geographic region(s) based on the detected languages.

**CAPTION:**
${caption || '(No caption provided)'}

**TRANSCRIPT:**
${transcript || '(No transcript provided)'}

**TOP COMMENTS (analyzing top ${comments.length} comments):**
${commentsText}

**ANALYSIS REQUIREMENTS:**

1. **Caption Language Detection:**
   - Detect the language of the caption text (use ISO 639-1 language codes like 'en', 'hi', 'ta', 'te', 'ml', 'kn', 'gu', 'pa', 'bn', 'ur', 'mr', etc.)
   - If the text is mixed language or unclear, use the primary language or 'unknown'
   - Provide a confidence score between 0.0 and 1.0

2. **Transcript Language Detection:**
   - Detect the language of the transcript text (use ISO 639-1 language codes)
   - If the text is mixed language or unclear, use the primary language or 'unknown'
   - Provide a confidence score between 0.0 and 1.0

3. **Comments Language Analysis:**
   - Analyze each comment and detect its language
   - Create a distribution showing:
     * Language code (ISO 639-1)
     * Language name (e.g., "Tamil", "Hindi", "English")
     * Count of comments in that language
     * Percentage of total comments
     * 2-3 example comments in that language
   - Identify the top 3-5 languages by count

4. **Region Detection:**
   - Based on the detected languages, determine the geographic region(s)
   - Map languages to regions using this logic:
     * Tamil (ta) → Tamil Nadu, India
     * Telugu (te) → Andhra Pradesh / Telangana, India
     * Malayalam (ml) → Kerala, India
     * Kannada (kn) → Karnataka, India
     * Gujarati (gu) → Gujarat, India
     * Punjabi (pa) → Punjab, India / Pakistan
     * Bengali (bn) → West Bengal, India / Bangladesh
     * Marathi (mr) → Maharashtra, India
     * Hindi (hi) → North India (multiple states)
     * Urdu (ur) → Pakistan / North India
     * English (en) → Could be multiple regions (India, US, UK, etc.)
     * And other languages to their respective regions
   - For each detected region, provide:
     * Region name (e.g., "Tamil Nadu", "North India", "Kerala")
     * Country (if applicable, e.g., "India", "Pakistan", "Bangladesh")
     * Confidence score (0.0-1.0)
     * Reasoning (2-3 sentences explaining why this region is detected)
     * Primary languages that indicate this region
     * Percentage of content in languages associated with this region

5. **Primary Region:**
   - Determine the PRIMARY region based on the highest confidence and language distribution
   - This should be the most likely geographic location of the audience/creator

**OUTPUT FORMAT (JSON only, no markdown, no code blocks):**
{
  "caption": {
    "language": "en",
    "languageConfidence": 0.95
  },
  "transcript": {
    "language": "ta",
    "languageConfidence": 0.92
  },
  "comments": {
    "totalAnalyzed": 20,
    "languageDistribution": [
      {
        "language": "ta",
        "languageName": "Tamil",
        "count": 12,
        "percentage": 60.0,
        "examples": ["Example comment 1", "Example comment 2"]
      },
      {
        "language": "en",
        "languageName": "English",
        "count": 5,
        "percentage": 25.0,
        "examples": ["Example comment 1", "Example comment 2"]
      },
      {
        "language": "hi",
        "languageName": "Hindi",
        "count": 3,
        "percentage": 15.0,
        "examples": ["Example comment 1"]
      }
    ],
    "topLanguages": [
      {
        "language": "ta",
        "languageName": "Tamil",
        "count": 12,
        "percentage": 60.0
      },
      {
        "language": "en",
        "languageName": "English",
        "count": 5,
        "percentage": 25.0
      }
    ]
  },
  "regions": [
    {
      "region": "Tamil Nadu",
      "country": "India",
      "confidence": 0.85,
      "reasoning": "60% of comments are in Tamil, which is primarily spoken in Tamil Nadu, India",
      "primaryLanguages": ["ta"],
      "languagePercentage": 60.0
    },
    {
      "region": "North India",
      "country": "India",
      "confidence": 0.40,
      "reasoning": "15% of comments are in Hindi, indicating some North Indian audience",
      "primaryLanguages": ["hi"],
      "languagePercentage": 15.0
    }
  ],
  "primaryRegion": {
    "region": "Tamil Nadu",
    "country": "India",
    "confidence": 0.85,
    "reasoning": "Tamil is the dominant language (60% of comments), strongly indicating Tamil Nadu as the primary region"
  }
}

**IMPORTANT:**
- Return ONLY valid JSON, no additional text before or after
- Ensure all language codes are ISO 639-1 format (2-letter codes)
- Ensure confidence scores are numbers between 0.0 and 1.0
- If language cannot be determined, use "unknown"
- Sort languageDistribution and topLanguages by count (descending)
- Sort regions by confidence (descending)
- Be thorough but concise in your reasoning
- If no clear region can be determined, set primaryRegion to null with appropriate reasoning`;
  }

  /**
   * Analyze language and region using Gemini
   */
  async analyzeLanguageAndRegion(
    caption: string | null | undefined,
    transcript: string | null | undefined,
    comments: Array<{ text: string }>
  ): Promise<GeminiLanguageRegionAnalysisResult> {
    const startTime = Date.now();

    // Check if Gemini is configured
    if (!this.isConfigured()) {
      logger.warn('Gemini not configured, returning default analysis');
      return {
        caption: {
          language: 'unknown',
        },
        transcript: {
          language: 'unknown',
        },
        comments: {
          totalAnalyzed: 0,
          languageDistribution: [],
          topLanguages: [],
        },
        regions: [],
        primaryRegion: null,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Normalize inputs
    const captionText = caption?.trim() || null;
    const transcriptText = transcript?.trim() || null;
    
    // Get top comments (limit to 30 for analysis)
    const topComments = (comments || [])
      .filter(c => c?.text?.trim())
      .slice(0, 30)
      .map(c => ({ text: c.text.trim() }));

    // If no content available, return default
    if (!captionText && !transcriptText && topComments.length === 0) {
      logger.warn('No content available for language and region analysis');
      return {
        caption: {
          language: 'unknown',
        },
        transcript: {
          language: 'unknown',
        },
        comments: {
          totalAnalyzed: 0,
          languageDistribution: [],
          topLanguages: [],
        },
        regions: [],
        primaryRegion: null,
        processingTimeMs: Date.now() - startTime,
      };
    }

    try {
      const prompt = this.getLanguageRegionAnalysisPrompt(captionText, transcriptText, topComments);

      logger.debug(
        {
          captionLength: captionText?.length || 0,
          transcriptLength: transcriptText?.length || 0,
          commentsCount: topComments.length,
          model: this.modelName,
        },
        'Sending language and region analysis request to Gemini'
      );

      // Call Gemini API
      const result = await this.client!.models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      // Check if response has candidates
      if (!result.candidates || result.candidates.length === 0) {
        const promptFeedback = (result as any).promptFeedback;
        if (promptFeedback?.blockReason) {
          throw new Error(`Content blocked: ${promptFeedback.blockReason}`);
        }
        throw new Error('No candidates returned from Gemini API');
      }

      // Extract text from response
      const text = result.candidates[0]?.content?.parts?.[0]?.text || '';
      
      if (!text) {
        const finishReason = result.candidates[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          throw new Error(`Content generation stopped: ${finishReason}`);
        }
        throw new Error('Empty response from Gemini API');
      }

      // Parse JSON response
      let jsonText = text.trim();
      jsonText = jsonText.replace(/^```json\s*/i, '');
      jsonText = jsonText.replace(/^```\s*/i, '');
      jsonText = jsonText.replace(/\s*```$/i, '');
      jsonText = jsonText.trim();

      // Try to extract JSON if there's extra text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const analysis = JSON.parse(jsonText) as {
        caption: { 
          language: string;
          languageConfidence?: number;
        };
        transcript: { 
          language: string;
          languageConfidence?: number;
        };
        comments: {
          totalAnalyzed: number;
          languageDistribution: Array<{
            language: string;
            languageName: string;
            count: number;
            percentage: number;
            examples: string[];
          }>;
          topLanguages: Array<{
            language: string;
            languageName: string;
            count: number;
            percentage: number;
          }>;
        };
        regions: Array<{
          region: string;
          country?: string;
          confidence: number;
          reasoning: string;
          primaryLanguages: string[];
          languagePercentage: number;
        }>;
        primaryRegion: {
          region: string;
          country?: string;
          confidence: number;
          reasoning: string;
        } | null;
      };

      // Normalize language code
      const normalizeLanguage = (language: string | undefined): string => {
        if (!language || typeof language !== 'string') {
          return 'unknown';
        }
        const normalized = language.trim().toLowerCase();
        if (normalized.length === 2 && /^[a-z]{2}$/.test(normalized)) {
          return normalized;
        }
        const languageMap: Record<string, string> = {
          'english': 'en',
          'hindi': 'hi',
          'spanish': 'es',
          'french': 'fr',
          'german': 'de',
          'chinese': 'zh',
          'japanese': 'ja',
          'korean': 'ko',
          'arabic': 'ar',
          'portuguese': 'pt',
          'russian': 'ru',
          'italian': 'it',
          'dutch': 'nl',
          'swedish': 'sv',
          'polish': 'pl',
          'turkish': 'tr',
          'vietnamese': 'vi',
          'thai': 'th',
          'indonesian': 'id',
          'malay': 'ms',
          'tamil': 'ta',
          'telugu': 'te',
          'malayalam': 'ml',
          'kannada': 'kn',
          'gujarati': 'gu',
          'punjabi': 'pa',
          'bengali': 'bn',
          'urdu': 'ur',
          'marathi': 'mr',
          'persian': 'fa',
          'farsi': 'fa',
          'hebrew': 'he',
        };
        const mapped = languageMap[normalized];
        return mapped || 'unknown';
      };

      // Normalize confidence
      const normalizeConfidence = (confidence: number | undefined): number => {
        if (typeof confidence !== 'number' || isNaN(confidence)) {
          return 0.5;
        }
        return Math.max(0.0, Math.min(1.0, confidence));
      };

      // Normalize language distribution
      const normalizedLanguageDistribution = (analysis.comments.languageDistribution || []).map(lang => ({
        language: normalizeLanguage(lang.language),
        languageName: lang.languageName || lang.language,
        count: Math.max(0, Math.round(lang.count || 0)),
        percentage: Math.max(0, Math.min(100, lang.percentage || 0)),
        examples: Array.isArray(lang.examples) ? lang.examples.slice(0, 3) : [],
      }));

      // Normalize top languages
      const normalizedTopLanguages = (analysis.comments.topLanguages || []).map(lang => ({
        language: normalizeLanguage(lang.language),
        languageName: lang.languageName || lang.language,
        count: Math.max(0, Math.round(lang.count || 0)),
        percentage: Math.max(0, Math.min(100, lang.percentage || 0)),
      }));

      // Normalize regions
      const normalizedRegions = (analysis.regions || []).map(region => ({
        region: region.region || 'Unknown',
        country: region.country || undefined,
        confidence: normalizeConfidence(region.confidence),
        reasoning: region.reasoning || 'No reasoning provided',
        primaryLanguages: Array.isArray(region.primaryLanguages) 
          ? region.primaryLanguages.map(normalizeLanguage)
          : [],
        languagePercentage: Math.max(0, Math.min(100, region.languagePercentage || 0)),
      }));

      const result_data: GeminiLanguageRegionAnalysisResult = {
        caption: {
          language: normalizeLanguage(analysis.caption?.language),
          languageConfidence: analysis.caption?.languageConfidence !== undefined
            ? normalizeConfidence(analysis.caption.languageConfidence)
            : undefined,
        },
        transcript: {
          language: normalizeLanguage(analysis.transcript?.language),
          languageConfidence: analysis.transcript?.languageConfidence !== undefined
            ? normalizeConfidence(analysis.transcript.languageConfidence)
            : undefined,
        },
        comments: {
          totalAnalyzed: Math.max(0, Math.round(analysis.comments?.totalAnalyzed || topComments.length)),
          languageDistribution: normalizedLanguageDistribution,
          topLanguages: normalizedTopLanguages,
        },
        regions: normalizedRegions,
        primaryRegion: analysis.primaryRegion ? {
          region: analysis.primaryRegion.region || 'Unknown',
          country: analysis.primaryRegion.country || undefined,
          confidence: normalizeConfidence(analysis.primaryRegion.confidence),
          reasoning: analysis.primaryRegion.reasoning || 'No reasoning provided',
        } : null,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info(
        {
          captionLanguage: result_data.caption.language,
          transcriptLanguage: result_data.transcript.language,
          commentsAnalyzed: result_data.comments.totalAnalyzed,
          topLanguage: result_data.comments.topLanguages[0]?.language,
          primaryRegion: result_data.primaryRegion?.region,
          processingTimeMs: result_data.processingTimeMs,
        },
        'Gemini language and region analysis completed'
      );

      return result_data;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      const errorDetails = error?.response?.data || error?.error || error;
      
      logger.error(
        {
          error: errorMessage,
          errorDetails: typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails,
          stack: error?.stack,
          commentsCount: topComments.length,
        },
        'Gemini language and region analysis failed'
      );

      let cleanErrorMessage = errorMessage;
      if (typeof errorDetails === 'object' && errorDetails.message) {
        cleanErrorMessage = errorDetails.message;
      } else if (typeof errorDetails === 'string') {
        try {
          const parsed = JSON.parse(errorDetails);
          cleanErrorMessage = parsed.message || parsed.error?.message || cleanErrorMessage;
        } catch {
          cleanErrorMessage = errorDetails;
        }
      }

      return {
        caption: {
          language: 'unknown',
        },
        transcript: {
          language: 'unknown',
        },
        comments: {
          totalAnalyzed: topComments.length,
          languageDistribution: [],
          topLanguages: [],
        },
        regions: [],
        primaryRegion: null,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
}

export const geminiLanguageRegionAnalysis = new GeminiLanguageRegionAnalysisService();
