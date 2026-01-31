'use client';

import { useState, useEffect } from 'react';
import { ENGAGEMENT_RATIO_THRESHOLDS, ENGAGEMENT_RATIO_LABELS } from '@/utils/constants';

interface EngagementAnalysisTabProps {
  scrapingData?: any;
  persistedData?: any;
  onDataUpdate?: (data: any) => void;
}

export default function EngagementAnalysisTab({ scrapingData, persistedData, onDataUpdate }: EngagementAnalysisTabProps) {
  const [reelUrl, setReelUrl] = useState('');
  const [intervalHours, setIntervalHours] = useState(1);
  const [tracking, setTracking] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submissionInfo, setSubmissionInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementData, setEngagementData] = useState<any>(persistedData || null);

  // Add a state to track the interval unit (hours or minutes)
  const [intervalUnit, setIntervalUnit] = useState<'hours' | 'minutes'>('hours');

  // Add a state to track the tracking status of the reel
  const [isTracking, setIsTracking] = useState(false);

  // Helper to get engagement data in consistent format
  const getEngagementData = () => {
    if (!engagementData) return null;
    // Handle both formats: { data: {...} } or just {...}
    return engagementData.data || engagementData;
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/view-tracking/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchSnapshots = async (showEmptyMessage: boolean = true) => {
    if (!reelUrl) {
      setSnapshots([]);
      setError(null);
      return;
    }
    
    // Only clear error if we're not showing an empty message (to prevent flickering)
    if (showEmptyMessage) {
      setError(null);
    }
    
    try {
      const response = await fetch(
        `/api/view-tracking/snapshots?reelUrl=${encodeURIComponent(reelUrl)}&limit=100`
      );
      const data = await response.json();
      if (data.success) {
        const fetchedSnapshots = data.snapshots || [];
        setSnapshots(fetchedSnapshots);
        
        // Only show empty message if explicitly requested and no snapshots exist
        if (fetchedSnapshots.length === 0 && showEmptyMessage) {
          if (data.message) {
            setError(data.message);
          } else {
            setError('No tracking data found for this reel. Start tracking to begin collecting view snapshots.');
          }
        } else if (fetchedSnapshots.length > 0) {
          // Clear error if we have snapshots
          setError(null);
        }
      } else {
        // Only set error for actual failures, not empty results
        if (data.error && !data.error.includes('No submission found')) {
          setError(data.error);
        } else if (showEmptyMessage) {
          setError('No tracking data found for this reel. Start tracking to begin collecting view snapshots.');
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch snapshots:', error);
      // Only set error for actual failures
      if (showEmptyMessage) {
        setError(error.message || 'Failed to fetch snapshots');
      }
    }
  };

  const startTracking = async () => {
    if (!reelUrl) {
      alert('Please enter a reel URL');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const intervalInHours = intervalUnit === 'minutes' ? intervalHours / 60 : intervalHours;

      const response = await fetch('/api/view-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reelUrl,
          intervalHours: intervalInHours,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTracking(true);
        setIsTracking(true); // Sync so Start/Stop/Fetch buttons update immediately
        setSubmissionInfo({
          submissionId: data.submissionId,
          reelUrl: data.reelUrl,
        });
        setError(null);
        alert('View tracking started successfully!');
        // Fetch snapshots after starting tracking (show message if empty)
        fetchSnapshots(true);
      } else {
        const errorMsg = data.error || 'Failed to start tracking';
        setError(errorMsg);
        // Don't show alert for "no submission found" - error is already displayed in UI
        if (!errorMsg.includes('No submission found')) {
          alert(errorMsg);
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to start tracking';
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const stopTracking = async () => {
    if (!reelUrl) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/view-tracking?reelUrl=${encodeURIComponent(reelUrl)}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success) {
        setTracking(false);
        setIsTracking(false); // Sync so Start/Stop/Fetch buttons update immediately
        alert('View tracking stopped');
      } else {
        setError(data.error || 'Failed to stop tracking');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to stop tracking';
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Fetch snapshots when reel URL changes (show message for new URLs)
    if (reelUrl) {
      fetchSnapshots(true);
    } else {
      setSnapshots([]);
      setError(null);
    }
  }, [reelUrl]);

  // Sync with persisted data when it changes
  useEffect(() => {
    if (persistedData) {
      setEngagementData(persistedData);
    }
  }, [persistedData]);

  const runEngagementAnalysis = async () => {
    if (!scrapingData) {
      setError('Please scrape data first');
      return;
    }

    setEngagementLoading(true);
    setError(null);

    try {
      const metadata = scrapingData.data?.metadata || scrapingData.metadata;
      const reelUrl = scrapingData.data?.metadata?.reelUrl || scrapingData.reelUrl || scrapingData.data?.reelUrl || '';
      const creator = scrapingData.data?.creator;

      // Build historical engagement from creator's latest posts (up to 10) for z-score cross-post comparison
      const latestPosts = (creator?.latestPosts || []).slice(0, 12);
      const currentReelNormalized = reelUrl ? reelUrl.replace(/\?.*$/, '').replace(/\/+$/, '') : '';
      const historicalEngagement = latestPosts
        .filter((post: any) => {
          const postUrl = (post.url || post.permalink || '').replace(/\?.*$/, '').replace(/\/+$/, '');
          return postUrl && postUrl !== currentReelNormalized;
        })
        .slice(0, 10)
        .map((post: any) => ({
          timestamp: (post.timestamp && new Date(post.timestamp).toISOString()) || new Date().toISOString(),
          likes: post.likes ?? post.likesCount ?? 0,
          views: post.views ?? post.viewsCount ?? post.playCount ?? null,
          comments: post.comments ?? post.commentsCount ?? 0,
          shares: post.shares ?? null,
        }));

      // Current post stats: prefer metadata, fallback to matching post in latestPosts (so we never send 0 when data exists)
      const currentPostFromFeed = latestPosts.find((post: any) => {
        const postUrl = (post.url || post.permalink || '').replace(/\?.*$/, '').replace(/\/+$/, '');
        return postUrl && postUrl === currentReelNormalized;
      });
      const engagementLikes = metadata?.likes ?? metadata?.likeCount ?? currentPostFromFeed?.likes ?? currentPostFromFeed?.likesCount ?? 0;
      const engagementViews = metadata?.views ?? metadata?.playCount ?? currentPostFromFeed?.views ?? currentPostFromFeed?.viewsCount ?? currentPostFromFeed?.playCount ?? 0;
      const engagementCommentsCount = Array.isArray(metadata?.comments) ? metadata.comments.length : (metadata?.commentCount ?? currentPostFromFeed?.comments ?? currentPostFromFeed?.commentsCount ?? 0);

      const response = await fetch('/api/verify/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reelUrl,
          comments: metadata?.comments || [],
          engagement: {
            timestamp: new Date().toISOString(),
            likes: engagementLikes,
            views: engagementViews,
            comments: engagementCommentsCount,
          },
          followerCount: creator?.followersCount ?? creator?.followers ?? null,
          historicalEngagement,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Engagement analysis failed');
      }

      setEngagementData(data);
      if (onDataUpdate) {
        onDataUpdate(data);
      }
    } catch (err: any) {
      setError(err.message || 'Engagement analysis failed');
    } finally {
      setEngagementLoading(false);
    }
  };

  // Removed auto-refresh - user will manually refresh when needed

  // Detect spikes in snapshots
  const detectSpikes = () => {
    if (snapshots.length < 2) return [];

    const spikes: any[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i];
      const curr = snapshots[i - 1];
      
      const timeDiff = (new Date(curr.snapshotAt).getTime() - new Date(prev.snapshotAt).getTime()) / (1000 * 60 * 60); // hours
      const viewIncrease = curr.viewCount - prev.viewCount;
      const increasePercentage = prev.viewCount > 0 ? (viewIncrease / prev.viewCount) * 100 : 0;

      // Check if spike was already detected by backend or detect manually
      if (curr.isSpikeDetected || (timeDiff <= 1 && increasePercentage > 50)) {
        spikes.push({
          ...curr,
          increasePercentage: increasePercentage.toFixed(1),
          timeDiff: timeDiff.toFixed(2),
          viewIncrease,
          prevViewCount: prev.viewCount,
        });
      }
    }
    return spikes;
  };

  const spikes = detectSpikes();

  // Calculate Engagement Ratio (use stored value from DB if available, otherwise calculate)
  const calculateEngagementRatio = (snapshot: any): { ratio: number; percentage: string; label: string; color: string } | null => {
    if (!snapshot || snapshot.viewCount === 0) return null;

    // Use stored engagementRatio from DB if available
    if (snapshot.engagementRatio !== null && snapshot.engagementRatio !== undefined) {
      const percentage = snapshot.engagementRatio.toFixed(2);
      const label = snapshot.engagementLabel || ENGAGEMENT_RATIO_LABELS.AVERAGE;
      
      let color: string;
      if (snapshot.engagementRatio < ENGAGEMENT_RATIO_THRESHOLDS.SUSPICIOUS) {
        color = 'red';
      } else if (snapshot.engagementRatio >= ENGAGEMENT_RATIO_THRESHOLDS.SUSPICIOUS && 
                 snapshot.engagementRatio < ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MIN) {
        color = 'orange';
      } else if (snapshot.engagementRatio >= ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MIN && 
                 snapshot.engagementRatio <= ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MAX) {
        color = 'yellow';
      } else {
        color = 'green';
      }

      return {
        ratio: snapshot.engagementRatio / 100,
        percentage,
        label,
        color,
      };
    }

    // Fallback: calculate from current snapshot data
    const likes = snapshot.likeCount || 0;
    const comments = snapshot.commentCount || 0;
    const shares = snapshot.shareCount || 0;
    const saves = 0; // Saves are not currently tracked in snapshots
    
    const totalEngagement = likes + comments + shares + saves;
    const ratio = totalEngagement / snapshot.viewCount;
    const percentage = (ratio * 100).toFixed(2);

    let label: string;
    let color: string;

    if (ratio < ENGAGEMENT_RATIO_THRESHOLDS.SUSPICIOUS / 100) {
      label = ENGAGEMENT_RATIO_LABELS.SUSPICIOUS;
      color = 'red';
    } else if (ratio >= ENGAGEMENT_RATIO_THRESHOLDS.SUSPICIOUS / 100 && ratio < ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MIN / 100) {
      label = ENGAGEMENT_RATIO_LABELS.SUSPICIOUS; // Between 0.5% and 1% is still suspicious
      color = 'orange';
    } else if (ratio >= ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MIN / 100 && ratio <= ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MAX / 100) {
      label = ENGAGEMENT_RATIO_LABELS.AVERAGE;
      color = 'yellow';
    } else if (ratio >= ENGAGEMENT_RATIO_THRESHOLDS.STRONG_MIN / 100) {
      label = ENGAGEMENT_RATIO_LABELS.STRONG;
      color = 'green';
    } else {
      // Between 3% and 4% - transition zone, still average
      label = ENGAGEMENT_RATIO_LABELS.AVERAGE;
      color = 'yellow';
    }

    return {
      ratio,
      percentage,
      label,
      color,
    };
  };

  // Calculate statistics from snapshots
  const calculateStats = () => {
    if (snapshots.length === 0) return null;

    const sorted = [...snapshots].sort((a, b) => 
      new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime()
    );
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalIncrease = last.viewCount - first.viewCount;
    const totalIncreasePercentage = first.viewCount > 0 
      ? ((totalIncrease / first.viewCount) * 100).toFixed(1)
      : '0';

    // Calculate engagement ratio for the latest snapshot
    const latestEngagementRatio = calculateEngagementRatio(last);

    return {
      totalSnapshots: snapshots.length,
      firstSnapshot: first,
      lastSnapshot: last,
      totalIncrease,
      totalIncreasePercentage,
      spikeCount: spikes.length,
      latestEngagementRatio,
    };
  };

  const snapshotStats = calculateStats();

  // Update the useEffect to check the tracking status and update button states
  useEffect(() => {
    const checkTrackingStatus = async () => {
      if (!reelUrl) {
        setIsTracking(false);
        return;
      }

      try {
        const response = await fetch(`/api/view-tracking/status?reelUrl=${encodeURIComponent(reelUrl)}`);
        const data = await response.json();
        if (data.success) {
          setIsTracking(data.isTracking);
        } else {
          setIsTracking(false);
        }
      } catch (error) {
        console.error('Failed to check tracking status:', error);
        setIsTracking(false);
      }
    };

    checkTrackingStatus();
  }, [reelUrl]);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Views Spike Detection & Engagement Ratio analysis (Dynamic)</h1>
      <p className="text-sm text-gray-600 mb-6">
            This section keeps snapshots of view counts, engagement metrics, and detects suspicious spikes in views over time. 
            It tracks changes in views, likes, comments, and shares at regular intervals to identify potential fraudulent activity 
            or artificial view inflation.
          </p>

      {/* Queue Stats */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Queue Statistics</h2>
        {stats ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">Waiting</div>
              <div className="text-2xl font-bold">{stats.waiting}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">Active</div>
              <div className="text-2xl font-bold">{stats.active}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-600">Completed</div>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-sm text-gray-600">Failed</div>
              <div className="text-2xl font-bold">{stats.failed}</div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="text-sm text-gray-600">Delayed</div>
              <div className="text-2xl font-bold">{stats.delayed}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Paused</div>
              <div className="text-2xl font-bold">{stats.paused}</div>
            </div>
          </div>
        ) : (
          <p>Loading stats...</p>
        )}
      </div>

      {/* Start/Stop Tracking */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">View Tracking</h2>
        {error && snapshots.length === 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium mb-1">⚠️ Notice</p>
            <p className="text-yellow-700 text-sm">{error}</p>
            {error.includes('No submission found') && (
              <p className="text-yellow-600 text-xs mt-2">
                <strong>Tip:</strong> A submission must exist in the database before tracking can start. 
                You can create a submission through the Data Scraping tab or use an existing submission ID.
              </p>
            )}
          </div>
        )}
        {submissionInfo && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Submission ID:</strong> {submissionInfo.submissionId}
            </p>
            <p className="text-sm text-blue-800">
              <strong>Reel URL:</strong> {submissionInfo.reelUrl}
            </p>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instagram Reel URL
            </label>
            <input
              type="text"
              value={reelUrl}
              onChange={(e) => {
                setReelUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://instagram.com/reel/ABC123 or instagram.com/reel/ABC123"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the Instagram reel URL to track view spikes
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interval
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                min={intervalUnit === 'hours' ? 0.5 : 1}
                max={intervalUnit === 'hours' ? 24 : 1440}
                step={intervalUnit === 'hours' ? 0.5 : 1}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <select
                value={intervalUnit}
                onChange={(e) => setIntervalUnit(e.target.value as 'hours' | 'minutes')}
                className="px-2 py-2 border border-gray-300 rounded-lg"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={startTracking}
              disabled={loading || isTracking || !reelUrl}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Start Tracking
            </button>
            <button
              onClick={stopTracking}
              disabled={loading || !isTracking || !reelUrl}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Stop Tracking
            </button>
            <button
              onClick={() => fetchSnapshots(true)}
              disabled={!isTracking || !reelUrl}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Fetch Snapshots
            </button>
            <button
              onClick={() => fetchSnapshots(true)}
              disabled={!reelUrl}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Refresh Snapshots
            </button>
          </div>
        </div>
      </div>

      {/* Spike Detection */}
      {spikes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-red-800 mb-4">
            ⚠️ View Spikes Detected ({spikes.length})
          </h2>
          <div className="space-y-2">
            {spikes.map((spike, index) => (
              <div key={index} className="bg-white p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">
                      {spike.increasePercentage}% increase in {spike.timeDiff} hours
                    </p>
                    <p className="text-sm text-gray-600">
                      Views: {spike.viewCount} | Likes: {spike.likeCount || 0} | 
                      {spike.isSpikeDetected && (
                        <span className="text-red-600 ml-2">
                          SPIKE: {spike.spikeReason}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-red-200 text-red-800 rounded">
                    Fraudulent
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics Summary */}
      {snapshotStats && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Tracking Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Snapshots</div>
              <div className="text-2xl font-bold">{snapshotStats.totalSnapshots}</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">Initial Views</div>
              <div className="text-2xl font-bold">{snapshotStats.firstSnapshot.viewCount.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">Current Views</div>
              <div className="text-2xl font-bold">{snapshotStats.lastSnapshot.viewCount.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Increase</div>
              <div className="text-2xl font-bold">
                {snapshotStats.totalIncrease > 0 ? '+' : ''}{snapshotStats.totalIncrease.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">({snapshotStats.totalIncreasePercentage}%)</div>
            </div>
          </div>
          {snapshotStats.spikeCount > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">
                ⚠️ {snapshotStats.spikeCount} spike(s) detected
              </p>
            </div>
          )}
        </div>
      )}

      {/* Engagement Ratio Analysis */}
      {snapshotStats && snapshotStats.latestEngagementRatio && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Engagement Ratio Analysis</h2>
          
          {/* Current Engagement Ratio */}
          <div className="mb-6">
            <div className={`p-6 rounded-lg border-2 ${
              snapshotStats.latestEngagementRatio.color === 'red' ? 'bg-red-50 border-red-300' :
              snapshotStats.latestEngagementRatio.color === 'orange' ? 'bg-orange-50 border-orange-300' :
              snapshotStats.latestEngagementRatio.color === 'yellow' ? 'bg-yellow-50 border-yellow-300' :
              'bg-green-50 border-green-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Current Engagement Ratio</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Based on latest snapshot: {new Date(snapshotStats.lastSnapshot.snapshotAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${
                    snapshotStats.latestEngagementRatio.color === 'red' ? 'text-red-700' :
                    snapshotStats.latestEngagementRatio.color === 'orange' ? 'text-orange-700' :
                    snapshotStats.latestEngagementRatio.color === 'yellow' ? 'text-yellow-700' :
                    'text-green-700'
                  }`}>
                    {snapshotStats.latestEngagementRatio.percentage}%
                  </div>
                  <div className={`text-sm font-medium mt-1 ${
                    snapshotStats.latestEngagementRatio.color === 'red' ? 'text-red-800' :
                    snapshotStats.latestEngagementRatio.color === 'orange' ? 'text-orange-800' :
                    snapshotStats.latestEngagementRatio.color === 'yellow' ? 'text-yellow-800' :
                    'text-green-800'
                  }`}>
                    {snapshotStats.latestEngagementRatio.label}
                  </div>
                </div>
              </div>
              
              {/* Breakdown */}
              <div className="mt-4 pt-4 border-t border-gray-300">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Views:</span>
                    <span className="font-semibold ml-2">{snapshotStats.lastSnapshot.viewCount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Likes:</span>
                    <span className="font-semibold ml-2">{(snapshotStats.lastSnapshot.likeCount || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Comments:</span>
                    <span className="font-semibold ml-2">{(snapshotStats.lastSnapshot.commentCount || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Shares:</span>
                    <span className="font-semibold ml-2">{(snapshotStats.lastSnapshot.shareCount || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  <strong>Formula:</strong> Engagement Ratio = (Likes + Comments + Shares + Saves) ÷ Views
                  <br />
                  <em>Note: Saves are not currently tracked in snapshots</em>
                </div>
              </div>
            </div>
          </div>

          {/* Engagement Thresholds */}
          <div>
            <h3 className="text-md font-semibold mb-3 text-gray-700">Engagement Thresholds</h3>
            <div className="space-y-2">
              <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <div className="flex-1">
                  <span className="font-medium text-red-800">Suspicious:</span>
                  <span className="text-red-700 ml-2">Less than {ENGAGEMENT_RATIO_THRESHOLDS.SUSPICIOUS}%</span>
                </div>
              </div>
              <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <div className="flex-1">
                  <span className="font-medium text-yellow-800">Average:</span>
                  <span className="text-yellow-700 ml-2">{ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MIN}% - {ENGAGEMENT_RATIO_THRESHOLDS.AVERAGE_MAX}%</span>
                </div>
              </div>
              <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <div className="flex-1">
                  <span className="font-medium text-green-800">Strong or Organic:</span>
                  <span className="text-green-700 ml-2">{ENGAGEMENT_RATIO_THRESHOLDS.STRONG_MIN}% or higher</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              <em>These thresholds are configurable and can be updated in the codebase.</em>
            </p>
          </div>
        </div>
      )}

      {/* Snapshots Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">View Spike Detection</h2>
          <p className="text-sm text-gray-600">
            Snapshots are collected at your configured interval (e.g. every 1 hour). 
            Engagement Ratio = (Likes + Comments + Shares + Saves) ÷ Views. 
            Thresholds: &lt;0.5% Suspicious, 1–3% Average, 4–8%+ Strong or Organic.
          </p>
        </div>
        <div className="flex justify-between items-center mb-4">
          <div></div>
          <div className="flex gap-2">
            {reelUrl && (
              <>
                <button
                  onClick={() => fetchSnapshots(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Refresh Data
                </button>
                <button
                  onClick={() => {
                    fetchStats();
                    if (reelUrl) fetchSnapshots(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Refresh Stats
                </button>
              </>
            )}
          </div>
        </div>
        {snapshots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left p-3 font-semibold text-gray-700">Timestamp</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Views</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Likes</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Comments</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Shares</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Engagement Ratio</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Change</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot, index) => {
                  const prevSnapshot = index < snapshots.length - 1 ? snapshots[index + 1] : null;
                  const viewChange = prevSnapshot 
                    ? snapshot.viewCount - prevSnapshot.viewCount 
                    : 0;
                  const viewChangePercent = prevSnapshot && prevSnapshot.viewCount > 0
                    ? ((viewChange / prevSnapshot.viewCount) * 100).toFixed(1)
                    : '0';
                  const timeDiff = prevSnapshot
                    ? ((new Date(snapshot.snapshotAt).getTime() - new Date(prevSnapshot.snapshotAt).getTime()) / (1000 * 60 * 60)).toFixed(1)
                    : '-';

                  // Calculate engagement ratio for this snapshot
                  const engagementRatio = calculateEngagementRatio(snapshot);

                  return (
                    <tr 
                      key={snapshot.id} 
                      className={`border-b hover:bg-gray-50 ${
                        snapshot.isSpikeDetected ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="p-3 text-sm">
                        {new Date(snapshot.snapshotAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-semibold text-gray-900">
                        {snapshot.viewCount.toLocaleString()}
                      </td>
                      <td className="p-3 text-gray-700">
                        {(snapshot.likeCount || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-gray-700">
                        {(snapshot.commentCount || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-gray-700">
                        {(snapshot.shareCount || 0).toLocaleString()}
                      </td>
                      <td className="p-3">
                        {engagementRatio ? (
                          <div className="text-sm">
                            <div className={`font-semibold ${
                              engagementRatio.color === 'red' ? 'text-red-700' :
                              engagementRatio.color === 'orange' ? 'text-orange-700' :
                              engagementRatio.color === 'yellow' ? 'text-yellow-700' :
                              'text-green-700'
                            }`}>
                              {engagementRatio.percentage}%
                            </div>
                            <div className={`text-xs ${
                              engagementRatio.color === 'red' ? 'text-red-600' :
                              engagementRatio.color === 'orange' ? 'text-orange-600' :
                              engagementRatio.color === 'yellow' ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {engagementRatio.label}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {prevSnapshot ? (
                          <div className="text-sm">
                            <div className={`font-medium ${
                              viewChange > 0 ? 'text-green-600' : 
                              viewChange < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {viewChange > 0 ? '+' : ''}{viewChange.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {viewChangePercent}% ({timeDiff}h)
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {snapshot.isSpikeDetected ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                            ⚠️ SPIKE
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            ✓ Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {snapshotStats && snapshotStats.spikeCount > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Spike Details:</strong> {snapshotStats.spikeCount} spike(s) detected. 
                  Check individual rows for spike reasons.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            {reelUrl ? (
              <div>
                <p className="text-gray-500 mb-2">No snapshots found for this reel.</p>
                <p className="text-sm text-gray-400">
                  {error || 'Start tracking to begin collecting view data.'}
                </p>
              </div>
            ) : (
              <p className="text-gray-500">Enter a reel URL above to view tracking data.</p>
            )}
          </div>
        )}
      </div>

      <div className="mb-8 mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Static Engagement Analysis</h2>
        <p className="text-sm text-gray-600">
            Uses cross-post comparison: the current post&apos;s like count is compared against historical data from the creator&apos;s other posts (up to 10 latest). 
            A z-score–based statistical analysis flags posts that deviate significantly (e.g. &gt;2 standard deviations above the creator&apos;s average) as potentially inauthentic. 
            Comment analysis evaluates quality, detects duplicate or emoji-only comments, and estimates bot likelihood. 
            Works for static uploads because it compares across different posts rather than tracking the same post over time—no time-series data required.
        </p>
      </div>

      {/* Engagement Authenticity Verification */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={runEngagementAnalysis}
            disabled={engagementLoading || !scrapingData}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {engagementLoading ? 'Running...' : 'Run Engagement Analysis'}
          </button>
        </div>

        {!scrapingData && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800">
              Please scrape data first using the Data Scraping tab.
            </p>
          </div>
        )}

        {(() => {
          const data = getEngagementData();
          if (!data) return null;
          
          return (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(engagementData, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `engagement-analysis-${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  📥 Download
                </button>
              </div>

              {/* Overall Assessment */}
              {data.overallAssessment && (
                <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-green-900">Overall Assessment:</span>
                    <span className={`px-4 py-2 rounded-full font-bold ${
                      data.overallAssessment === 'AUTHENTIC' ? 'bg-green-600 text-white' :
                      data.overallAssessment === 'SUSPICIOUS' ? 'bg-yellow-600 text-white' :
                      'bg-red-600 text-white'
                    }`}>
                      {data.overallAssessment}
                    </span>
                    {data.overallScore !== undefined && (
                      <span className="text-lg font-bold text-green-900">
                        {data.overallScore?.toFixed(1) || '0.0'}%
                      </span>
                    )}
                  </div>
                  {data.promotionTimestamp && (
                    <div className="text-sm text-gray-700">
                      Promotion Timestamp: {new Date(data.promotionTimestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Comment Analysis */}
              {data.commentAnalysis && (
                <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Comment Analysis</h3>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <span className="text-sm text-gray-600">Total Comments:</span>
                      <div className="text-2xl font-bold">{data.commentAnalysis.totalComments || 0}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Suspicious:</span>
                      <div className="text-2xl font-bold text-red-600">
                        {data.commentAnalysis.suspiciousCount || 0}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Bot Likelihood:</span>
                      <div className="text-2xl font-bold text-green-600">
                        {data.commentAnalysis.botLikelihood 
                          ? (data.commentAnalysis.botLikelihood * 100).toFixed(1) + '%'
                          : '0.0%'}
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Comments */}
                  {data.commentAnalysis.duplicateComments && data.commentAnalysis.duplicateComments.count > 0 && (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-3">
                      <div className="font-semibold text-gray-900 mb-2">
                        Duplicate Comments: <span className="font-bold">{data.commentAnalysis.duplicateComments.count} found</span>
                      </div>
                      {data.commentAnalysis.duplicateComments.examples && data.commentAnalysis.duplicateComments.examples.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-sm text-gray-600">Examples:</span>
                          {data.commentAnalysis.duplicateComments.examples.map((example: any, idx: number) => (
                            <div key={idx} className="text-sm">
                              {example.text || example} {example.count && `(${example.count}x)`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Emoji-Only Comments */}
                  {data.commentAnalysis.emojiOnlyCount !== undefined && data.commentAnalysis.emojiOnlyCount > 0 && (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-3">
                      <div className="font-semibold text-gray-900">
                        Emoji-Only Comments: <span className="font-bold">{data.commentAnalysis.emojiOnlyCount} found</span>
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {data.commentAnalysis.recommendations && data.commentAnalysis.recommendations.length > 0 && (
                    <div className="mt-3">
                      <span className="font-semibold text-gray-900 block mb-2">Recommendations:</span>
                      <ul className="space-y-1">
                        {data.commentAnalysis.recommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <span className="text-green-600">✔</span>
                            <span className={rec.includes('RISK') || rec.includes('risk') ? 'text-gray-700' : 'text-gray-700'}>
                              {rec}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Engagement Pattern Analysis (from metrics; z-score uses historical when available) */}
              {data.engagementAnalysis && (
                <div className="bg-white border border-gray-300 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Engagement Pattern Analysis</h3>
                  {(() => {
                    const m = data.engagementAnalysis.metrics;
                    const likes = m?.totalLikes ?? data.engagementAnalysis.likes ?? 0;
                    const comments = m?.totalComments ?? data.engagementAnalysis.comments ?? 0;
                    const engagementRate = m?.engagementRate ?? data.engagementAnalysis.engagementRate;
                    return (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <span className="text-sm text-gray-600">Likes:</span>
                      <div className="text-2xl font-bold">
                        {typeof likes === 'number' ? likes.toLocaleString() : (likes ?? 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Comments:</span>
                      <div className="text-2xl font-bold">
                        {typeof comments === 'number' ? comments.toLocaleString() : (comments ?? 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Engagement Rate:</span>
                      <div className="text-2xl font-bold">
                        {engagementRate != null && typeof engagementRate === 'number'
                          ? Number(engagementRate).toFixed(2) + '%'
                          : '—'}
                      </div>
                    </div>
                  </div>
                    );
                  })()}

                  {/* Recommendations */}
                  {data.engagementAnalysis.recommendations && data.engagementAnalysis.recommendations.length > 0 && (
                    <div>
                      <span className="font-semibold text-gray-900 block mb-2">Recommendations:</span>
                      <ul className="space-y-1">
                        {data.engagementAnalysis.recommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <span className="text-green-600">✔</span>
                            <span className="text-gray-700">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {(engagementData.processingTimeMs || data.processingTimeMs) && (
                <div className="text-xs text-gray-500 mt-4">
                  Processing time: {(engagementData.processingTimeMs || data.processingTimeMs)}ms
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
