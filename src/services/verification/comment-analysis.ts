// Service for analyzing comments to detect bot-like behavior, fake engagement, and automated comments
// Checks for duplicate comments, emoji-only comments, spam patterns, and suspicious timing patterns

import logger from '@/utils/logger';

/**
 * Comment data structure
 */
export interface CommentData {
  id?: string;
  text: string;
  author: string;
  ownerUsername?: string;
  timestamp: Date;
  likes?: number;
  likesCount?: number;
  replies?: CommentData[];
}

/**
 * Comment Analysis Result
 */
export interface CommentAnalysisResult {
  totalComments: number;
  suspiciousComments: number;
  suspiciousCommentPercentage: number;
  botLikelihood: number; // 0-1, where 1 is highly likely bots
  issues: {
    duplicateComments: {
      count: number;
      examples: Array<{ text: string; count: number; authors: string[] }>;
    };
    emojiOnlyComments: {
      count: number;
      examples: Array<{ text: string; author: string }>;
    };
    genericComments: {
      count: number;
      examples: Array<{ text: string; author: string }>;
    };
    suspiciousTiming: {
      detected: boolean;
      description: string;
      rapidComments?: Array<{ text: string; author: string; timestamp: Date }>;
    };
    spamPatterns: {
      count: number;
      examples: Array<{ text: string; author: string; pattern: string }>;
    };
  };
  recommendations: string[];
}

/**
 * Generic/spam comment patterns
 */
const GENERIC_COMMENT_PATTERNS = [
  /^great$/i,
  /^nice$/i,
  /^good$/i,
  /^cool$/i,
  /^awesome$/i,
  /^amazing$/i,
  /^love it$/i,
  /^fire$/i,
  /^lit$/i,
  /^perfect$/i,
  /^wow$/i,
  /^omg$/i,
  /^so good$/i,
  /^best$/i,
  /^incredible$/i,
  /^fantastic$/i,
  /^super$/i,
  /^excellent$/i,
  /^brilliant$/i,
  /^outstanding$/i,
];

const SPAM_PATTERNS = [
  /check out my/i,
  /follow me/i,
  /dm me/i,
  /link in bio/i,
  /click here/i,
  /free/i,
  /discount/i,
  /promo code/i,
  /visit my/i,
  /check my/i,
  /follow for follow/i,
  /f4f/i,
  /like4like/i,
  /l4l/i,
];

/**
 * Comment Analysis Service
 */
class CommentAnalysisService {
  /**
   * Check if comment is emoji-only
   */
  private isEmojiOnly(text: string): boolean {
    // Remove whitespace and check if remaining is only emojis
    const cleaned = text.trim();
    if (cleaned.length === 0) return false;
    
    // Emoji regex pattern (covers most emojis)
    const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2764}\u{FE0F}\u{200D}\u{FE0F}\s]+$/u;
    
    return emojiRegex.test(cleaned);
  }

  /**
   * Check if comment is generic
   */
  private isGenericComment(text: string): boolean {
    const cleaned = text.trim().toLowerCase();
    return GENERIC_COMMENT_PATTERNS.some(pattern => pattern.test(cleaned));
  }

  /**
   * Check if comment contains spam patterns
   */
  private containsSpamPattern(text: string): string | null {
    const cleaned = text.toLowerCase();
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(cleaned)) {
        return pattern.source;
      }
    }
    return null;
  }

  /**
   * Normalize comment text for duplicate detection
   */
  private normalizeCommentText(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2764}\u{FE0F}\u{200D}\u{FE0F}]/gu, ''); // Keep only alphanumeric, spaces, and emojis
  }

  /**
   * Analyze comments for bot-like behavior
   */
  analyzeComments(comments: CommentData[]): CommentAnalysisResult {
    const startTime = Date.now();
    
    if (!Array.isArray(comments) || comments.length === 0) {
      return {
        totalComments: 0,
        suspiciousComments: 0,
        suspiciousCommentPercentage: 0,
        botLikelihood: 0,
        issues: {
          duplicateComments: { count: 0, examples: [] },
          emojiOnlyComments: { count: 0, examples: [] },
          genericComments: { count: 0, examples: [] },
          suspiciousTiming: { detected: false, description: 'No comments to analyze' },
          spamPatterns: { count: 0, examples: [] },
        },
        recommendations: ['No comments available for analysis'],
      };
    }

    const totalComments = comments.length;
    const suspiciousComments = new Set<string>(); // Track comment IDs or indices
    const issues = {
      duplicateComments: { count: 0, examples: [] as Array<{ text: string; count: number; authors: string[] }> },
      emojiOnlyComments: { count: 0, examples: [] as Array<{ text: string; author: string }> },
      genericComments: { count: 0, examples: [] as Array<{ text: string; author: string }> },
      suspiciousTiming: { detected: false, description: '', rapidComments: [] as Array<{ text: string; author: string; timestamp: Date }> },
      spamPatterns: { count: 0, examples: [] as Array<{ text: string; author: string; pattern: string }> },
    };

    // Track duplicate comments
    const commentTextMap = new Map<string, { count: number; authors: Set<string>; originalText: string }>();
    
    // Track comments by timestamp for timing analysis
    const commentsByTime = comments
      .map((comment, index) => ({ ...comment, index, timestamp: new Date(comment.timestamp) }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Analyze each comment
    comments.forEach((comment, index) => {
      const text = comment.text.trim();
      const author = comment.ownerUsername || comment.author;
      
      if (!text) return;

      // Check for emoji-only comments
      if (this.isEmojiOnly(text)) {
        issues.emojiOnlyComments.count++;
        suspiciousComments.add(`${index}`);
        if (issues.emojiOnlyComments.examples.length < 5) {
          issues.emojiOnlyComments.examples.push({ text, author });
        }
      }

      // Check for generic comments
      if (this.isGenericComment(text)) {
        issues.genericComments.count++;
        suspiciousComments.add(`${index}`);
        if (issues.genericComments.examples.length < 5) {
          issues.genericComments.examples.push({ text, author });
        }
      }

      // Check for spam patterns
      const spamPattern = this.containsSpamPattern(text);
      if (spamPattern) {
        issues.spamPatterns.count++;
        suspiciousComments.add(`${index}`);
        if (issues.spamPatterns.examples.length < 5) {
          issues.spamPatterns.examples.push({ text, author, pattern: spamPattern });
        }
      }

      // Track duplicates (normalize text first)
      const normalizedText = this.normalizeCommentText(text);
      if (normalizedText.length > 0) {
        if (!commentTextMap.has(normalizedText)) {
          commentTextMap.set(normalizedText, {
            count: 1,
            authors: new Set([author]),
            originalText: text,
          });
        } else {
          const entry = commentTextMap.get(normalizedText)!;
          entry.count++;
          entry.authors.add(author);
          suspiciousComments.add(`${index}`);
        }
      }
    });

    // Find duplicate comments (appearing 2+ times)
    commentTextMap.forEach((entry, normalizedText) => {
      if (entry.count >= 2) {
        issues.duplicateComments.count += entry.count;
        if (issues.duplicateComments.examples.length < 5) {
          issues.duplicateComments.examples.push({
            text: entry.originalText,
            count: entry.count,
            authors: Array.from(entry.authors),
          });
        }
      }
    });

    // Analyze timing patterns (rapid comments in short time)
    if (commentsByTime.length >= 3) {
      const rapidComments: Array<{ text: string; author: string; timestamp: Date }> = [];
      const timeWindow = 60 * 1000; // 1 minute in milliseconds
      
      for (let i = 0; i < commentsByTime.length - 2; i++) {
        const current = commentsByTime[i];
        const next = commentsByTime[i + 1];
        const afterNext = commentsByTime[i + 2];
        
        const timeDiff1 = next.timestamp.getTime() - current.timestamp.getTime();
        const timeDiff2 = afterNext.timestamp.getTime() - next.timestamp.getTime();
        
        // If 3+ comments within 1 minute, it's suspicious
        if (timeDiff1 < timeWindow && timeDiff2 < timeWindow) {
          if (rapidComments.length === 0) {
            rapidComments.push({
              text: current.text,
              author: current.ownerUsername || current.author,
              timestamp: current.timestamp,
            });
          }
          rapidComments.push({
            text: next.text,
            author: next.ownerUsername || next.author,
            timestamp: next.timestamp,
          });
          rapidComments.push({
            text: afterNext.text,
            author: afterNext.ownerUsername || afterNext.author,
            timestamp: afterNext.timestamp,
          });
        }
      }

      if (rapidComments.length >= 3) {
        issues.suspiciousTiming.detected = true;
        issues.suspiciousTiming.description = `Detected ${rapidComments.length} comments posted within rapid succession (likely automated)`;
        issues.suspiciousTiming.rapidComments = rapidComments.slice(0, 10); // Limit examples
      } else {
        issues.suspiciousTiming.description = 'Comment timing appears normal';
      }
    }

    // Calculate bot likelihood score (0-1)
    const suspiciousCount = suspiciousComments.size;
    const suspiciousPercentage = (suspiciousCount / totalComments) * 100;
    
    // Weight different factors
    let botLikelihood = 0;
    
    // Duplicate comments weight: 30%
    if (issues.duplicateComments.count > 0) {
      const duplicateRatio = Math.min(issues.duplicateComments.count / totalComments, 1);
      botLikelihood += duplicateRatio * 0.3;
    }
    
    // Emoji-only comments weight: 20%
    if (issues.emojiOnlyComments.count > 0) {
      const emojiRatio = Math.min(issues.emojiOnlyComments.count / totalComments, 1);
      botLikelihood += emojiRatio * 0.2;
    }
    
    // Generic comments weight: 20%
    if (issues.genericComments.count > 0) {
      const genericRatio = Math.min(issues.genericComments.count / totalComments, 1);
      botLikelihood += genericRatio * 0.2;
    }
    
    // Spam patterns weight: 15%
    if (issues.spamPatterns.count > 0) {
      const spamRatio = Math.min(issues.spamPatterns.count / totalComments, 1);
      botLikelihood += spamRatio * 0.15;
    }
    
    // Suspicious timing weight: 15%
    if (issues.suspiciousTiming.detected) {
      botLikelihood += 0.15;
    }

    // Cap at 1.0
    botLikelihood = Math.min(botLikelihood, 1.0);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (botLikelihood >= 0.7) {
      recommendations.push('⚠️ HIGH RISK: Significant bot-like activity detected. Manual review recommended.');
    } else if (botLikelihood >= 0.4) {
      recommendations.push('⚠️ MODERATE RISK: Some suspicious activity detected. Review recommended.');
    } else if (botLikelihood >= 0.2) {
      recommendations.push('ℹ️ LOW RISK: Minor suspicious patterns detected. Generally acceptable.');
    } else {
      recommendations.push('✅ LOW RISK: Comments appear authentic with minimal bot-like behavior.');
    }

    if (issues.duplicateComments.count > 0) {
      recommendations.push(`Found ${issues.duplicateComments.count} duplicate comments. This may indicate bot activity.`);
    }

    if (issues.suspiciousTiming.detected) {
      recommendations.push('Rapid comment timing detected. This may indicate automated commenting.');
    }

    if (issues.spamPatterns.count > 0) {
      recommendations.push(`Found ${issues.spamPatterns.count} comments with spam patterns.`);
    }

    const result: CommentAnalysisResult = {
      totalComments,
      suspiciousComments: suspiciousCount,
      suspiciousCommentPercentage: suspiciousPercentage,
      botLikelihood,
      issues,
      recommendations,
    };

    logger.info(
      {
        totalComments,
        suspiciousComments: suspiciousCount,
        botLikelihood,
        processingTimeMs: Date.now() - startTime,
      },
      'Comment analysis completed'
    );

    return result;
  }
}

export const commentAnalysisService = new CommentAnalysisService();
