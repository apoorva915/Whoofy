// Service for analyzing engagement patterns to detect fake views, likes, and engagement manipulation
// Analyzes likes/views over time, engagement rates, and suspicious patterns

import logger from '@/utils/logger';

/**
 * Engagement data structure
 */
export interface EngagementData {
  timestamp: Date;
  likes: number;
  views?: number | null;
  comments: number;
  shares?: number | null;
}

/**
 * Engagement Analysis Result
 */
export interface EngagementAnalysisResult {
  isAuthentic: boolean;
  authenticityScore: number; // 0-1, where 1 is highly authentic
  promotionTimestamp: Date | null;
  issues: {
    suspiciousLikePattern: {
      detected: boolean;
      description: string;
      spikeDetected?: boolean;
      spikeTime?: Date;
      spikeValue?: number;
    };
    engagementRateAnomaly: {
      detected: boolean;
      description: string;
      expectedRate?: number;
      actualRate?: number;
    };
    viewLikeRatioAnomaly: {
      detected: boolean;
      description: string;
      ratio?: number;
      expectedRange?: { min: number; max: number };
    };
    rapidEngagementGrowth: {
      detected: boolean;
      description: string;
      growthRate?: number;
    };
  };
  metrics: {
    totalLikes: number;
    totalViews: number | null;
    totalComments: number;
    totalShares: number | null;
    likeToViewRatio: number | null;
    commentToLikeRatio: number;
    engagementRate: number | null; // Requires follower count
  };
  recommendations: string[];
}

/**
 * Engagement Analysis Service
 */
class EngagementAnalysisService {
  /**
   * Analyze engagement patterns for authenticity
   */
  analyzeEngagement(
    currentEngagement: EngagementData,
    historicalData?: EngagementData[],
    followerCount?: number
  ): EngagementAnalysisResult {
    const startTime = Date.now();
    
    const promotionTimestamp = currentEngagement.timestamp;
    const issues = {
      suspiciousLikePattern: {
        detected: false,
        description: '',
      },
      engagementRateAnomaly: {
        detected: false,
        description: '',
      },
      viewLikeRatioAnomaly: {
        detected: false,
        description: '',
      },
      rapidEngagementGrowth: {
        detected: false,
        description: '',
      },
    };

    const metrics = {
      totalLikes: currentEngagement.likes,
      totalViews: currentEngagement.views || null,
      totalComments: currentEngagement.comments,
      totalShares: currentEngagement.shares || null,
      likeToViewRatio: currentEngagement.views ? currentEngagement.likes / currentEngagement.views : null,
      commentToLikeRatio: currentEngagement.likes > 0 ? currentEngagement.comments / currentEngagement.likes : 0,
      engagementRate: followerCount && followerCount > 0 
        ? ((currentEngagement.likes + currentEngagement.comments + (currentEngagement.shares || 0)) / followerCount) * 100
        : null,
    };

    // Analyze like-to-view ratio (if views available)
    if (metrics.likeToViewRatio !== null) {
      // Typical Instagram engagement: 1-5% like-to-view ratio
      // Suspicious if > 20% (too many likes for views) or < 0.1% (too few likes)
      const expectedMin = 0.001; // 0.1%
      const expectedMax = 0.20; // 20%
      
      if (metrics.likeToViewRatio > expectedMax) {
        issues.viewLikeRatioAnomaly.detected = true;
        issues.viewLikeRatioAnomaly.description = `Unusually high like-to-view ratio (${(metrics.likeToViewRatio * 100).toFixed(2)}%). This may indicate fake likes or manipulated views.`;
        issues.viewLikeRatioAnomaly.ratio = metrics.likeToViewRatio;
        issues.viewLikeRatioAnomaly.expectedRange = { min: expectedMin, max: expectedMax };
      } else if (metrics.likeToViewRatio < expectedMin && currentEngagement.views && currentEngagement.views > 1000) {
        issues.viewLikeRatioAnomaly.detected = true;
        issues.viewLikeRatioAnomaly.description = `Unusually low like-to-view ratio (${(metrics.likeToViewRatio * 100).toFixed(2)}%). This may indicate fake views.`;
        issues.viewLikeRatioAnomaly.ratio = metrics.likeToViewRatio;
        issues.viewLikeRatioAnomaly.expectedRange = { min: expectedMin, max: expectedMax };
      } else {
        issues.viewLikeRatioAnomaly.description = `Like-to-view ratio (${(metrics.likeToViewRatio * 100).toFixed(2)}%) appears normal.`;
      }
    }

    // Analyze engagement rate (if follower count available)
    if (metrics.engagementRate !== null && followerCount) {
      // Typical Instagram engagement rate: 1-5% for most accounts
      // Suspicious if > 15% (unrealistically high) or < 0.1% (very low)
      const expectedMin = 0.1;
      const expectedMax = 15;
      
      if (metrics.engagementRate > expectedMax) {
        issues.engagementRateAnomaly.detected = true;
        issues.engagementRateAnomaly.description = `Unusually high engagement rate (${metrics.engagementRate.toFixed(2)}%). This may indicate fake engagement.`;
        issues.engagementRateAnomaly.expectedRate = expectedMax;
        issues.engagementRateAnomaly.actualRate = metrics.engagementRate;
      } else if (metrics.engagementRate < expectedMin && followerCount > 1000) {
        issues.engagementRateAnomaly.detected = true;
        issues.engagementRateAnomaly.description = `Unusually low engagement rate (${metrics.engagementRate.toFixed(2)}%). This may indicate fake followers or low-quality engagement.`;
        issues.engagementRateAnomaly.expectedRate = expectedMin;
        issues.engagementRateAnomaly.actualRate = metrics.engagementRate;
      } else {
        issues.engagementRateAnomaly.description = `Engagement rate (${metrics.engagementRate.toFixed(2)}%) appears normal.`;
      }
    }

    // Analyze historical data for spikes (if available)
    if (historicalData && historicalData.length > 0) {
      // Sort by timestamp
      const sortedData = [...historicalData, currentEngagement]
        .map(item => ({ ...item, timestamp: new Date(item.timestamp) }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Calculate average likes from historical data (excluding current)
      const historicalLikes = historicalData.map(item => item.likes);
      const avgHistoricalLikes = historicalLikes.reduce((sum, likes) => sum + likes, 0) / historicalLikes.length;
      const stdDevHistoricalLikes = this.calculateStandardDeviation(historicalLikes);

      // Check if current likes is a significant spike (> 2 standard deviations)
      if (stdDevHistoricalLikes > 0) {
        const zScore = (currentEngagement.likes - avgHistoricalLikes) / stdDevHistoricalLikes;
        
        if (zScore > 2) {
          issues.suspiciousLikePattern.detected = true;
          issues.suspiciousLikePattern.spikeDetected = true;
          issues.suspiciousLikePattern.spikeTime = promotionTimestamp;
          issues.suspiciousLikePattern.spikeValue = currentEngagement.likes;
          issues.suspiciousLikePattern.description = `Significant spike in likes detected (${zScore.toFixed(2)} standard deviations above average). This may indicate fake engagement.`;
        } else {
          issues.suspiciousLikePattern.description = `Like count (${currentEngagement.likes}) is within normal range compared to historical data.`;
        }
      }

      // Check for rapid growth pattern
      if (sortedData.length >= 2) {
        const timeDiff = sortedData[sortedData.length - 1].timestamp.getTime() - sortedData[0].timestamp.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff > 0 && hoursDiff < 24) {
          // Check if engagement grew too rapidly (within 24 hours)
          const likesGrowth = currentEngagement.likes - sortedData[0].likes;
          const growthRate = likesGrowth / hoursDiff;
          
          // Suspicious if > 1000 likes per hour for accounts with < 100k followers
          if (growthRate > 1000 && (!followerCount || followerCount < 100000)) {
            issues.rapidEngagementGrowth.detected = true;
            issues.rapidEngagementGrowth.growthRate = growthRate;
            issues.rapidEngagementGrowth.description = `Rapid engagement growth detected (${growthRate.toFixed(0)} likes/hour). This may indicate fake engagement manipulation.`;
          } else {
            issues.rapidEngagementGrowth.description = `Engagement growth rate appears normal.`;
          }
        }
      }
    } else {
      issues.suspiciousLikePattern.description = 'No historical data available for comparison.';
      issues.rapidEngagementGrowth.description = 'No historical data available for comparison.';
    }

    // Calculate authenticity score (0-1)
    let authenticityScore = 1.0;
    
    // Deduct points for each issue detected
    if (issues.suspiciousLikePattern.detected) {
      authenticityScore -= 0.3;
    }
    if (issues.engagementRateAnomaly.detected) {
      authenticityScore -= 0.25;
    }
    if (issues.viewLikeRatioAnomaly.detected) {
      authenticityScore -= 0.25;
    }
    if (issues.rapidEngagementGrowth.detected) {
      authenticityScore -= 0.2;
    }

    // Ensure score is between 0 and 1
    authenticityScore = Math.max(0, Math.min(1, authenticityScore));
    
    const isAuthentic = authenticityScore >= 0.6;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (!isAuthentic) {
      recommendations.push('⚠️ WARNING: Engagement authenticity concerns detected. Manual review recommended.');
    } else if (authenticityScore >= 0.8) {
      recommendations.push('✅ Engagement appears authentic with no significant anomalies detected.');
    } else {
      recommendations.push('ℹ️ Minor engagement anomalies detected. Generally acceptable but review recommended.');
    }

    if (issues.suspiciousLikePattern.detected) {
      recommendations.push('Significant spike in likes detected. Verify engagement is organic.');
    }

    if (issues.engagementRateAnomaly.detected) {
      recommendations.push('Engagement rate anomaly detected. Check follower quality.');
    }

    if (issues.viewLikeRatioAnomaly.detected) {
      recommendations.push('Like-to-view ratio anomaly detected. Verify views and likes are authentic.');
    }

    if (issues.rapidEngagementGrowth.detected) {
      recommendations.push('Rapid engagement growth detected. Verify growth is organic.');
    }

    const result: EngagementAnalysisResult = {
      isAuthentic,
      authenticityScore,
      promotionTimestamp,
      issues,
      metrics,
      recommendations,
    };

    logger.info(
      {
        isAuthentic,
        authenticityScore,
        promotionTimestamp,
        processingTimeMs: Date.now() - startTime,
      },
      'Engagement analysis completed'
    );

    return result;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }
}

export const engagementAnalysisService = new EngagementAnalysisService();
