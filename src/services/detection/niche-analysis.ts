// Service for analyzing creator niche from bio and latest posts using Google Gemini
// Analyzes the creator's bio combined with their last 5 posts to determine their niche

import { GoogleGenAI } from '@google/genai';
import { externalApiConfig, isApiConfigured } from '@/config/external-apis';
import { CreatorNiche } from '@/types/creator';
import logger from '@/utils/logger';

/**
 * Post data for niche analysis
 */
export interface PostData {
  caption: string | null;
  type: string;
  likes: number;
  comments: number;
}

/**
 * Niche Analysis Result from Gemini
 */
export interface NicheAnalysisResult {
  niches: CreatorNiche[];
  confidence: number;
  reasoning: string;
  processingTimeMs: number;
}

/**
 * Gemini Niche Analysis Service
 */
class NicheAnalysisService {
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
          logger.info({ model }, 'Gemini niche analysis service initialized');
        } catch (error: any) {
          logger.error({ error: error?.message }, 'Failed to initialize Gemini client for niche analysis');
        }
      }
    } else {
      logger.warn('Gemini API key not configured - niche analysis will use fallback');
    }
  }

  /**
   * Check if Gemini is configured and available
   */
  isConfigured(): boolean {
    return this.client !== null && isApiConfigured('gemini');
  }

  /**
   * Get available niche options as a string
   */
  private getAvailableNiches(): string {
    return Object.values(CreatorNiche).join(', ');
  }

  /**
   * Comprehensive prompt for niche analysis
   */
  private getNicheAnalysisPrompt(bio: string | null, posts: PostData[]): string {
    const postsText = posts.length > 0
      ? posts.map((post, idx) => {
          return `Post ${idx + 1}:
- Type: ${post.type}
- Caption: ${post.caption || '(No caption)'}
- Engagement: ${post.likes} likes, ${post.comments} comments`;
        }).join('\n\n')
      : '(No posts available)';

    return `You are an expert content creator niche classification system specializing in Instagram creators. Your task is to analyze a creator's bio and their latest posts to determine their primary niche(s).

**CREATOR BIO:**
${bio || '(No bio provided)'}

**LATEST POSTS (Last ${posts.length} posts):**
${postsText}

**AVAILABLE NICHES:**
${this.getAvailableNiches()}

**ANALYSIS REQUIREMENTS:**

1. **Analyze the Bio:**
   - Look for keywords, descriptions, and themes in the bio
   - Identify what the creator claims to be or do
   - Note any explicit niche mentions

2. **Analyze the Latest Posts:**
   - Review the content themes across all posts
   - Look for consistent topics, subjects, or content types
   - Consider the type of content (photos, videos, reels, etc.)
   - Note engagement patterns (which types of posts get more engagement)

3. **Determine Primary Niche(s):**
   - Based on BOTH the bio AND the actual content in posts, determine the creator's niche(s)
   - A creator can have MULTIPLE niches (e.g., Tech + Education, Fashion + Lifestyle)
   - Prioritize niches that are evident in BOTH bio and posts
   - If bio and posts don't align, prioritize what's actually in the posts (actions speak louder than words)
   - If unclear, choose "Other" as a fallback

4. **Confidence Assessment:**
   - Provide a confidence score between 0.0 and 1.0
   - Higher confidence if bio and posts align strongly
   - Lower confidence if there's inconsistency or limited content

**OUTPUT FORMAT (JSON only, no markdown, no code blocks):**
{
  "niches": ["Tech", "Education"],
  "confidence": 0.85,
  "reasoning": "The creator's bio mentions tech reviews and their last 5 posts consistently show tech product reviews and tutorials, indicating a strong Tech and Education niche focus."
}

**IMPORTANT:**
- Return ONLY valid JSON, no additional text before or after
- The "niches" array should contain one or more niche values from the available niches list
- Ensure confidence is a number between 0.0 and 1.0
- Provide clear reasoning explaining why these niches were chosen
- If the creator's content doesn't clearly fit any niche, use "Other"`;
  }

  /**
   * Analyze niche using Gemini
   */
  async analyzeNiche(
    bio: string | null | undefined,
    posts: PostData[]
  ): Promise<NicheAnalysisResult> {
    const startTime = Date.now();

    // Check if Gemini is configured
    if (!this.isConfigured()) {
      logger.warn('Gemini not configured, returning default niche');
      return {
        niches: [CreatorNiche.OTHER],
        confidence: 0.0,
        reasoning: 'Gemini API not configured',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Normalize inputs
    const bioText = bio?.trim() || null;
    const postsData = Array.isArray(posts) ? posts.slice(0, 5) : []; // Limit to last 5 posts

    // If both bio and posts are empty, return Other
    if (!bioText && postsData.length === 0) {
      logger.warn('Both bio and posts are empty');
      return {
        niches: [CreatorNiche.OTHER],
        confidence: 0.0,
        reasoning: 'No bio or posts available for niche analysis',
        processingTimeMs: Date.now() - startTime,
      };
    }

    try {
      const prompt = this.getNicheAnalysisPrompt(bioText, postsData);

      logger.debug(
        {
          bioLength: bioText?.length || 0,
          postsCount: postsData.length,
          model: this.modelName,
        },
        'Sending niche analysis request to Gemini'
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
        niches: string[];
        confidence: number;
        reasoning: string;
      };

      // Validate and normalize niche values
      const normalizeNiches = (niches: string[]): CreatorNiche[] => {
        const validNiches: CreatorNiche[] = [];
        const nicheMap = new Map<string, CreatorNiche>();
        
        // Create a map of all valid niches (case-insensitive)
        Object.values(CreatorNiche).forEach(niche => {
          nicheMap.set(niche.toLowerCase(), niche);
        });

        niches.forEach(niche => {
          const normalized = niche.trim();
          const matchedNiche = nicheMap.get(normalized.toLowerCase());
          if (matchedNiche) {
            validNiches.push(matchedNiche);
          } else {
            logger.warn({ niche }, 'Invalid niche value, skipping');
          }
        });

        // If no valid niches found, return Other
        return validNiches.length > 0 ? validNiches : [CreatorNiche.OTHER];
      };

      // Validate confidence score
      const normalizeConfidence = (confidence: number): number => {
        if (typeof confidence !== 'number' || isNaN(confidence)) {
          return 0.5;
        }
        return Math.max(0.0, Math.min(1.0, confidence));
      };

      const result_data: NicheAnalysisResult = {
        niches: normalizeNiches(analysis.niches || []),
        confidence: normalizeConfidence(analysis.confidence),
        reasoning: analysis.reasoning || 'No reasoning provided',
        processingTimeMs: Date.now() - startTime,
      };

      logger.info(
        {
          niches: result_data.niches,
          confidence: result_data.confidence,
          processingTimeMs: result_data.processingTimeMs,
        },
        'Gemini niche analysis completed'
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
          bioLength: bioText?.length || 0,
          postsCount: postsData.length,
        },
        'Gemini niche analysis failed'
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

      // Return default niche on error
      return {
        niches: [CreatorNiche.OTHER],
        confidence: 0.0,
        reasoning: `Niche analysis failed due to error: ${cleanErrorMessage}. Please check your GEMINI_API_KEY in the .env file.`,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
}

export const nicheAnalysisService = new NicheAnalysisService();
