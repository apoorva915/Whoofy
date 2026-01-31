/**
 * View spike detection service
 * Detects fraudulent view spikes by analyzing view count patterns
 */

export interface ViewSnapshot {
  viewCount: number;
  likeCount: number;
  timestamp: Date;
}

export interface ViewSpikeResult {
  isSpike: boolean;
  reason: string | null;
  spikePercentage?: number;
}

/**
 * Detect view spike based on historical data
 * 
 * A spike is detected if:
 * 1. Views increased by more than 50% in 1 hour (suspicious)
 * 2. Views increased but likes/comments didn't increase proportionally (engagement mismatch)
 * 3. Views increased by more than 200% in 1 hour (very suspicious)
 */
export function detectViewSpike(
  currentViewCount: number,
  previousSnapshots: ViewSnapshot[],
  currentLikeCount?: number
): ViewSpikeResult {
  if (previousSnapshots.length === 0) {
    // First snapshot - no spike detection possible
    return {
      isSpike: false,
      reason: null,
    };
  }

  // Get the most recent snapshot
  const lastSnapshot = previousSnapshots[0];
  const lastViewCount = lastSnapshot.viewCount;
  const lastLikeCount = lastSnapshot.likeCount;
  
  // Use provided currentLikeCount or get from snapshots
  const currentLike = currentLikeCount !== undefined ? currentLikeCount : (previousSnapshots.length > 0 ? previousSnapshots[0].likeCount : 0);

  // Calculate time difference in hours
  const timeDiffMs = Date.now() - lastSnapshot.timestamp.getTime();
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

  // Calculate view increase
  const viewIncrease = currentViewCount - lastViewCount;
  const viewIncreasePercentage = lastViewCount > 0 
    ? (viewIncrease / lastViewCount) * 100 
    : currentViewCount > 0 ? 100 : 0;

  // Rule 1: Very high spike (>200% increase in 1 hour)
  if (timeDiffHours <= 1 && viewIncreasePercentage > 200) {
    return {
      isSpike: true,
      reason: `Extreme view spike: ${viewIncreasePercentage.toFixed(1)}% increase in ${timeDiffHours.toFixed(2)} hours (${viewIncrease} views)`,
      spikePercentage: viewIncreasePercentage,
    };
  }

  // Rule 2: High spike (>50% increase in 1 hour) with low engagement
  if (timeDiffHours <= 1 && viewIncreasePercentage > 50) {
    // Check engagement mismatch if we have like count data
    if (currentLike !== undefined && currentLike !== null && lastLikeCount > 0) {
      const likeIncrease = currentLike - lastLikeCount;
      const likeIncreasePercentage = (likeIncrease / lastLikeCount) * 100;
      
      // If views increased significantly more than likes, it's suspicious
      if (viewIncreasePercentage > likeIncreasePercentage * 2) {
        return {
          isSpike: true,
          reason: `Suspicious view spike with engagement mismatch: ${viewIncreasePercentage.toFixed(1)}% view increase but only ${likeIncreasePercentage.toFixed(1)}% like increase in ${timeDiffHours.toFixed(2)} hours. This suggests fraudulent views.`,
          spikePercentage: viewIncreasePercentage,
        };
      }
    }
    
    // Flag any >50% increase in 1 hour as suspicious
    return {
      isSpike: true,
      reason: `Suspicious view spike: ${viewIncreasePercentage.toFixed(1)}% increase in ${timeDiffHours.toFixed(2)} hours (${viewIncrease} views). This may indicate fraudulent activity.`,
      spikePercentage: viewIncreasePercentage,
    };
  }

  // Rule 3: Check for engagement mismatch (if we have like data)
  // This would require comparing view-to-like ratio
  // For now, we'll use a simple heuristic: if views increased but engagement rate dropped significantly

  // Rule 4: Check for consistent spikes across multiple snapshots
  if (previousSnapshots.length >= 3) {
    const recentSnapshots = previousSnapshots.slice(0, 3);
    const allHaveSpikes = recentSnapshots.every((snapshot, index) => {
      if (index === recentSnapshots.length - 1) return false; // Last one
      const nextSnapshot = recentSnapshots[index + 1];
      const increase = snapshot.viewCount - nextSnapshot.viewCount;
      const increasePct = nextSnapshot.viewCount > 0 
        ? (increase / nextSnapshot.viewCount) * 100 
        : 0;
      return increasePct > 30; // More than 30% increase between consecutive snapshots
    });

    if (allHaveSpikes) {
      return {
        isSpike: true,
        reason: 'Consistent view spikes detected across multiple snapshots. Pattern suggests fraudulent activity.',
        spikePercentage: viewIncreasePercentage,
      };
    }
  }

  // No spike detected
  return {
    isSpike: false,
    reason: null,
  };
}

/**
 * Calculate engagement rate
 */
export function calculateEngagementRate(
  viewCount: number,
  likeCount: number,
  commentCount: number
): number {
  if (viewCount === 0) return 0;
  return ((likeCount + commentCount) / viewCount) * 100;
}
