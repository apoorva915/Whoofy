// Service for analyzing sentiment from transcript and captions using Google Gemini
// Provides comprehensive sentiment analysis with separate analysis for caption and transcript
// Determines if content provides positive publicity

import { GoogleGenAI } from '@google/genai';
import { externalApiConfig, isApiConfigured } from '@/config/external-apis';
import logger from '@/utils/logger';

/**
 * Sentiment type
 */
export type Sentiment = 'positive' | 'negative' | 'neutral';

/**
 * Sentiment Analysis Result from Gemini
 */
export interface GeminiSentimentAnalysisResult {
  caption: {
    sentiment: Sentiment;
    confidence: number;
    reasoning: string;
    language: string; // ISO 639-1 language code (e.g., 'en', 'hi', 'es')
    languageConfidence?: number; // Confidence in language detection (0-1)
  };
  transcript: {
    sentiment: Sentiment;
    confidence: number;
    reasoning: string;
    language: string; // ISO 639-1 language code (e.g., 'en', 'hi', 'es')
    languageConfidence?: number; // Confidence in language detection (0-1)
  };
  isPositivePublicity: boolean;
  overallReasoning: string;
  processingTimeMs: number;
}

/**
 * Gemini Sentiment Analysis Service
 */
class GeminiSentimentAnalysisService {
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
          logger.info({ model }, 'Gemini sentiment analysis service initialized');
        } catch (error: any) {
          logger.error({ error: error?.message }, 'Failed to initialize Gemini client');
        }
      }
    } else {
      logger.warn('Gemini API key not configured - sentiment analysis will use fallback');
    }
  }

  /**
   * Check if Gemini is configured and available
   */
  isConfigured(): boolean {
    return this.client !== null && isApiConfigured('gemini');
  }

  /**
   * Comprehensive prompt for sentiment analysis
   */
  private getSentimentAnalysisPrompt(caption: string | null, transcript: string | null): string {
    return `You are an expert sentiment analysis system specializing in social media content, particularly Instagram reels and posts. Your task is to analyze the sentiment of both the caption and transcript separately, and determine if the content provides positive publicity.

**CAPTION:**
${caption || '(No caption provided)'}

**TRANSCRIPT:**
${transcript || '(No transcript provided)'}

**ANALYSIS REQUIREMENTS:**

1. **Caption Sentiment Analysis:**
   - Analyze ONLY the caption text above
   - **FIRST, detect the language** of the caption text (use ISO 639-1 language codes like 'en', 'hi', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'pt', 'ru', 'it', 'nl', 'sv', 'pl', 'tr', 'vi', 'th', 'id', 'ms', 'ta', 'te', 'ml', 'kn', 'gu', 'pa', 'bn', 'ur', 'fa', 'he', etc.)
   - If the text is mixed language or unclear, use the primary language or 'unknown'
   - Determine if the sentiment is: "positive", "negative", or "neutral"
   - Consider:
     * Positive indicators: praise, recommendations, enthusiasm, satisfaction, excitement, positive emojis, endorsements
     * Negative indicators: complaints, criticism, disappointment, dissatisfaction, negative emojis, warnings
     * Neutral indicators: factual statements, neutral descriptions, no clear emotional tone
   - Provide a confidence score between 0.0 and 1.0 (where 1.0 is completely certain)
   - Provide a brief reasoning (2-3 sentences) explaining your assessment

2. **Transcript Sentiment Analysis:**
   - Analyze ONLY the transcript text above
   - **FIRST, detect the language** of the transcript text (use ISO 639-1 language codes like 'en', 'hi', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'pt', 'ru', 'it', 'nl', 'sv', 'pl', 'tr', 'vi', 'th', 'id', 'ms', 'ta', 'te', 'ml', 'kn', 'gu', 'pa', 'bn', 'ur', 'fa', 'he', etc.)
   - If the text is mixed language or unclear, use the primary language or 'unknown'
   - Apply the same sentiment classification (positive/negative/neutral)
   - Consider the spoken content, tone, and context
   - Provide a confidence score between 0.0 and 1.0
   - Provide a brief reasoning (2-3 sentences) explaining your assessment

3. **Positive Publicity Assessment:**
   - Determine if this content provides POSITIVE PUBLICITY overall
   - Consider:
     * Does it promote a brand/product favorably?
     * Is the overall message encouraging and positive?
     * Would this content make viewers more likely to purchase or engage with the brand?
     * Are there any negative aspects that outweigh the positive?
   - Answer with "true" if it's positive publicity, "false" if it's negative or neutral publicity
   - Provide overall reasoning (3-4 sentences) explaining why this is or isn't positive publicity

**OUTPUT FORMAT (JSON only, no markdown, no code blocks):**
{
  "caption": {
    "sentiment": "positive|negative|neutral",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation",
    "language": "en",
    "languageConfidence": 0.0-1.0
  },
  "transcript": {
    "sentiment": "positive|negative|neutral",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation",
    "language": "en",
    "languageConfidence": 0.0-1.0
  },
  "isPositivePublicity": true|false,
  "overallReasoning": "Detailed explanation of why this is or isn't positive publicity"
}

**IMPORTANT:**
- Return ONLY valid JSON, no additional text before or after
- Ensure all sentiment values are exactly "positive", "negative", or "neutral" (lowercase)
- Ensure confidence scores are numbers between 0.0 and 1.0
- Ensure language codes are ISO 639-1 format (2-letter codes like 'en', 'hi', 'es')
- If language cannot be determined, use "unknown"
- Ensure languageConfidence is a number between 0.0 and 1.0 (optional but recommended)
- Ensure isPositivePublicity is a boolean (true/false)
- Be thorough but concise in your reasoning`;
  }

  /**
   * Analyze sentiment using Gemini
   */
  async analyzeSentiment(
    caption: string | null | undefined,
    transcript: string | null | undefined
  ): Promise<GeminiSentimentAnalysisResult> {
    const startTime = Date.now();

    // Check if Gemini is configured
    if (!this.isConfigured()) {
      logger.warn('Gemini not configured, returning neutral sentiment');
      return {
        caption: {
          sentiment: 'neutral',
          confidence: 0.0,
          reasoning: 'Gemini API not configured',
          language: 'unknown',
        },
        transcript: {
          sentiment: 'neutral',
          confidence: 0.0,
          reasoning: 'Gemini API not configured',
          language: 'unknown',
        },
        isPositivePublicity: false,
        overallReasoning: 'Unable to analyze sentiment - Gemini API not configured',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Normalize inputs
    const captionText = caption?.trim() || null;
    const transcriptText = transcript?.trim() || null;

    // If both are empty, return neutral
    if (!captionText && !transcriptText) {
      logger.warn('Both caption and transcript are empty');
      return {
        caption: {
          sentiment: 'neutral',
          confidence: 0.0,
          reasoning: 'No caption provided',
          language: 'unknown',
        },
        transcript: {
          sentiment: 'neutral',
          confidence: 0.0,
          reasoning: 'No transcript provided',
          language: 'unknown',
        },
        isPositivePublicity: false,
        overallReasoning: 'No content available for sentiment analysis',
        processingTimeMs: Date.now() - startTime,
      };
    }

    try {
      const prompt = this.getSentimentAnalysisPrompt(captionText, transcriptText);

      logger.debug(
        {
          captionLength: captionText?.length || 0,
          transcriptLength: transcriptText?.length || 0,
          model: this.modelName,
        },
        'Sending sentiment analysis request to Gemini'
      );

      // Call Gemini API
      const result = await this.client!.models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      // Check if response has candidates
      if (!result.candidates || result.candidates.length === 0) {
        // Check for prompt feedback (which might indicate errors)
        const promptFeedback = (result as any).promptFeedback;
        if (promptFeedback?.blockReason) {
          throw new Error(`Content blocked: ${promptFeedback.blockReason}`);
        }
        throw new Error('No candidates returned from Gemini API');
      }

      // Extract text from response
      const text = result.candidates[0]?.content?.parts?.[0]?.text || '';
      
      if (!text) {
        // Check if there's a finish reason that indicates an issue
        const finishReason = result.candidates[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          throw new Error(`Content generation stopped: ${finishReason}`);
        }
        throw new Error('Empty response from Gemini API');
      }

      // Parse JSON response
      // Remove any markdown code blocks if present
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
          sentiment: string; 
          confidence: number; 
          reasoning: string;
          language: string;
          languageConfidence?: number;
        };
        transcript: { 
          sentiment: string; 
          confidence: number; 
          reasoning: string;
          language: string;
          languageConfidence?: number;
        };
        isPositivePublicity: boolean;
        overallReasoning: string;
      };

      // Validate and normalize sentiment values
      const normalizeSentiment = (sentiment: string): Sentiment => {
        const normalized = sentiment.toLowerCase().trim();
        if (normalized === 'positive' || normalized === 'negative' || normalized === 'neutral') {
          return normalized as Sentiment;
        }
        logger.warn({ sentiment }, 'Invalid sentiment value, defaulting to neutral');
        return 'neutral';
      };

      // Validate confidence scores
      const normalizeConfidence = (confidence: number): number => {
        if (typeof confidence !== 'number' || isNaN(confidence)) {
          return 0.5;
        }
        return Math.max(0.0, Math.min(1.0, confidence));
      };

      // Normalize language code
      const normalizeLanguage = (language: string | undefined): string => {
        if (!language || typeof language !== 'string') {
          return 'unknown';
        }
        // Convert to lowercase and validate ISO 639-1 format (2-letter code)
        const normalized = language.trim().toLowerCase();
        if (normalized.length === 2 && /^[a-z]{2}$/.test(normalized)) {
          return normalized;
        }
        // Map common language names to codes
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
          'persian': 'fa',
          'farsi': 'fa',
          'hebrew': 'he',
        };
        const mapped = languageMap[normalized];
        return mapped || 'unknown';
      };

      const result_data: GeminiSentimentAnalysisResult = {
        caption: {
          sentiment: normalizeSentiment(analysis.caption.sentiment),
          confidence: normalizeConfidence(analysis.caption.confidence),
          reasoning: analysis.caption.reasoning || 'No reasoning provided',
          language: normalizeLanguage(analysis.caption.language),
          languageConfidence: analysis.caption.languageConfidence !== undefined 
            ? normalizeConfidence(analysis.caption.languageConfidence) 
            : undefined,
        },
        transcript: {
          sentiment: normalizeSentiment(analysis.transcript.sentiment),
          confidence: normalizeConfidence(analysis.transcript.confidence),
          reasoning: analysis.transcript.reasoning || 'No reasoning provided',
          language: normalizeLanguage(analysis.transcript.language),
          languageConfidence: analysis.transcript.languageConfidence !== undefined 
            ? normalizeConfidence(analysis.transcript.languageConfidence) 
            : undefined,
        },
        isPositivePublicity: Boolean(analysis.isPositivePublicity),
        overallReasoning: analysis.overallReasoning || 'No overall reasoning provided',
        processingTimeMs: Date.now() - startTime,
      };

      logger.info(
        {
          captionSentiment: result_data.caption.sentiment,
          captionLanguage: result_data.caption.language,
          transcriptSentiment: result_data.transcript.sentiment,
          transcriptLanguage: result_data.transcript.language,
          isPositivePublicity: result_data.isPositivePublicity,
          processingTimeMs: result_data.processingTimeMs,
        },
        'Gemini sentiment analysis completed'
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
          captionLength: captionText?.length || 0,
          transcriptLength: transcriptText?.length || 0,
        },
        'Gemini sentiment analysis failed'
      );

      // Extract a cleaner error message
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

      // Return neutral sentiment on error
      return {
        caption: {
          sentiment: 'neutral',
          confidence: 0.0,
          reasoning: `Analysis failed: ${cleanErrorMessage}`,
          language: 'unknown',
        },
        transcript: {
          sentiment: 'neutral',
          confidence: 0.0,
          reasoning: `Analysis failed: ${cleanErrorMessage}`,
          language: 'unknown',
        },
        isPositivePublicity: false,
        overallReasoning: `Sentiment analysis failed due to error: ${cleanErrorMessage}. Please check your GEMINI_API_KEY in the .env file.`,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
}

export const geminiSentimentAnalysis = new GeminiSentimentAnalysisService();
