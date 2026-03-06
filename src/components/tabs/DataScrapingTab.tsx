'use client';

import { useState, useEffect } from 'react';

interface DataScrapingTabProps {
  persistedData?: any;
  onDataUpdate: (data: any) => void;
}

export default function DataScrapingTab({ persistedData, onDataUpdate }: DataScrapingTabProps) {
  const [reelUrl, setReelUrl] = useState(() => {
    if (persistedData) {
      return persistedData.data?.reelUrl || persistedData.data?.metadata?.reelUrl || persistedData.reelUrl || '';
    }
    return '';
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(persistedData || null);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);

  // Sync with persisted data when it changes
  useEffect(() => {
    if (persistedData) {
      setResult(persistedData);
      const url = persistedData.data?.reelUrl || persistedData.data?.metadata?.reelUrl || persistedData.reelUrl;
      if (url && url !== reelUrl) setReelUrl(url);
    }
  }, [persistedData]);

  const handleScrape = async () => {
    if (!reelUrl.trim()) {
      setError('Please enter a reel URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reelUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to scrape data');
      }

      setResult(data);
      onDataUpdate(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const metadata = result?.data?.metadata;
  const creator = result?.data?.creator;
  const sources = result?.data?.sources;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Data Scraping</h1>
      
      {/* Input Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instagram Reel URL
          </label>
          <input
            type="text"
            value={reelUrl}
            onChange={(e) => setReelUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleScrape}
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Scraping...' : 'Scrape Data'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Data Sources Section */}
          {sources && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Data Sources (Combined Results)</h2>
              <div className="flex flex-wrap gap-2 mb-2">
                {sources.reel && sources.reel.length > 0 && (
                  <>
                    {sources.reel.includes('instaloader') && (
                      <button
                        onClick={() => setActiveSource(activeSource === 'instaloader' ? null : 'instaloader')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeSource === 'instaloader'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                      >
                        Instaloader
                      </button>
                    )}
                    {sources.reel.includes('apify-reel-scraper') && (
                      <button
                        onClick={() => setActiveSource(activeSource === 'reel' ? null : 'reel')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeSource === 'reel'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                      >
                        Apify Reel Scraper
                      </button>
                    )}
                    {sources.reel.includes('apify-post-scraper') && (
                      <button
                        onClick={() => setActiveSource(activeSource === 'post' ? null : 'post')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeSource === 'post'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                      >
                        Apify Post Scraper
                      </button>
                    )}
                    {sources.reel.includes('apify-instagram-scraper') && (
                      <button
                        onClick={() => setActiveSource(activeSource === 'instagram' ? null : 'instagram')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeSource === 'instagram'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                      >
                        Apify Instagram Scraper
                      </button>
                    )}
                    {sources.reel.includes('apify-comments-scraper') && (
                      <button
                        onClick={() => setActiveSource(activeSource === 'comments' ? null : 'comments')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeSource === 'comments'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                      >
                        Apify Comments Scraper
                      </button>
                    )}
                    {sources.reel.includes('apify-transcript') && (
                      <button
                        onClick={() => setActiveSource(activeSource === 'transcript' ? null : 'transcript')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeSource === 'transcript'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                      >
                        Apify Transcript
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600">(Data merged from multiple sources)</p>
            </div>
          )}

          {/* Creator Profile Section */}
          {creator && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold">Creator Profile</h2>
                {sources?.creator && sources.creator.length > 0 && (
                  <button className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm font-medium">
                    {sources.creator.includes('instaloader-profile')
                      ? 'Instaloader Profile'
                      : 'Apify Profile Scraper'}
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <span className="text-sm text-gray-600">Username:</span>
                  <div className="font-semibold">@{creator.username}</div>
                </div>
                {creator.profileId && (
                  <div>
                    <span className="text-sm text-gray-600">Profile ID:</span>
                    <div className="font-semibold">{creator.profileId}</div>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-600">Followers:</span>
                  <div className="font-semibold">{creator.followers?.toLocaleString() || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Following:</span>
                  <div className="font-semibold">{creator.following?.toLocaleString() || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Posts:</span>
                  <div className="font-semibold">{creator.mediaCount?.toLocaleString() || 'N/A'}</div>
                </div>
                {creator.highlightReelsCount !== null && creator.highlightReelsCount !== undefined && (
                  <div>
                    <span className="text-sm text-gray-600">Highlight Reels:</span>
                    <div className="font-semibold">{creator.highlightReelsCount}</div>
                  </div>
                )}
                {creator.igtvVideoCount !== null && creator.igtvVideoCount !== undefined && (
                  <div>
                    <span className="text-sm text-gray-600">IGTV Videos:</span>
                    <div className="font-semibold">{creator.igtvVideoCount}</div>
                  </div>
                )}
                {creator.isRecentlyJoined !== null && creator.isRecentlyJoined !== undefined && (
                  <div>
                    <span className="text-sm text-gray-600">Recently Joined:</span>
                    <div className="font-semibold">{creator.isRecentlyJoined ? 'Yes' : 'No'}</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <span className="text-sm text-gray-600">Verified:</span>
                  <div className="font-semibold">{creator.verified ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Account Type:</span>
                  <div className="font-semibold">{creator.accountType || 'N/A'}</div>
                </div>
                {creator.businessCategory && (
                  <div>
                    <span className="text-sm text-gray-600">Business Category:</span>
                    <div className="font-semibold">{creator.businessCategory}</div>
                  </div>
                )}
              </div>

              {creator.bio && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-700">Bio:</span>
                  <div className="mt-1 text-sm whitespace-pre-wrap">{creator.bio}</div>
                </div>
              )}

              {creator.relatedProfiles && creator.relatedProfiles.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    Related Profiles ({creator.relatedProfiles.length}):
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {creator.relatedProfiles.map((profile: string, idx: number) => (
                      <span key={idx} className="text-sm text-blue-600 hover:underline">
                        @{profile}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reel Metadata Section */}
          {metadata && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Reel Metadata</h2>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(result, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `scraped-data-${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  📥 Download JSON
                </button>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <span className="text-sm text-gray-600">Likes:</span>
                  <div className="text-lg font-bold">{metadata.likes?.toLocaleString() || metadata.likeCount?.toLocaleString() || 'N/A'}</div>
                </div>
                {metadata.postType && (
                  <div>
                    <span className="text-sm text-gray-600">Post Type:</span>
                    <div className="text-lg font-bold">{metadata.postType}</div>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-600">Comments:</span>
                  <div className="text-lg font-bold">
                    {metadata.comments?.length || metadata.commentCount?.toLocaleString() || 'N/A'}
                  </div>
                </div>
                {metadata.duration && (
                  <div>
                    <span className="text-sm text-gray-600">Duration:</span>
                    <div className="text-lg font-bold">{metadata.duration.toFixed(1)}s</div>
                  </div>
                )}
                {metadata.timestamp && (
                  <div>
                    <span className="text-sm text-gray-600">Posted:</span>
                    <div className="text-sm font-medium">
                      {new Date(metadata.timestamp).toLocaleString()}
                    </div>
                  </div>
                )}
                {metadata.views && (
                  <div>
                    <span className="text-sm text-gray-600">Views:</span>
                    <div className="text-lg font-bold">{metadata.views.toLocaleString()}</div>
                  </div>
                )}
                {metadata.shares && (
                  <div>
                    <span className="text-sm text-gray-600">Shares:</span>
                    <div className="text-lg font-bold">{metadata.shares.toLocaleString()}</div>
                  </div>
                )}
              </div>

              {/* Caption */}
              {metadata.caption && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-700 block mb-2">Caption:</span>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm whitespace-pre-wrap">
                    {metadata.caption}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {metadata.transcript && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-700 block mb-2">Transcript:</span>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm whitespace-pre-wrap">
                    {metadata.transcript}
                  </div>
                </div>
              )}

              {/* Hashtags */}
              {metadata.hashtags && metadata.hashtags.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-700 block mb-2">Hashtags:</span>
                  <div className="flex flex-wrap gap-2">
                    {metadata.hashtags.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium hover:bg-blue-200 cursor-pointer transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mentions */}
              {metadata.mentions && metadata.mentions.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-700 block mb-2">Mentions:</span>
                  <div className="flex flex-wrap gap-2">
                    {metadata.mentions.map((mention: string, idx: number) => (
                      <span
                        key={idx}
                        className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium hover:bg-orange-200 cursor-pointer transition-colors"
                      >
                        @{mention}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              {metadata.comments && metadata.comments.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-700 block mb-2">
                    Comments ({metadata.comments.length}):
                  </span>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-4">
                      {metadata.comments.map((comment: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-start gap-3">
                            {/* Profile Picture */}
                            {comment.ownerProfilePicUrl && (
                              <img
                                src={comment.ownerProfilePicUrl}
                                alt={comment.ownerUsername || comment.author}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Ccircle cx="20" cy="20" r="18" fill="%23ddd"/%3E%3C/svg%3E';
                                }}
                              />
                            )}
                            <div className="flex-1">
                              {/* Username and Name */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm">
                                  {comment.ownerUsername || comment.author || 'Unknown'}
                                </span>
                                {comment.owner?.isVerified && (
                                  <span className="text-blue-500">✓</span>
                                )}
                                {comment.owner?.fullName && (
                                  <span className="text-xs text-gray-500">
                                    ({comment.owner.fullName})
                                  </span>
                                )}
                              </div>
                              {/* Comment Text */}
                              <div className="text-sm text-gray-700 mb-1">{comment.text}</div>
                              {/* Likes and Timestamp */}
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                {comment.likes !== undefined && comment.likes !== null && (
                                  <span>❤️ {comment.likes}</span>
                                )}
                                {comment.timestamp && (
                                  <span>
                                    {new Date(comment.timestamp).toLocaleString()}
                                  </span>
                                )}
                                <a
                                  href={comment.commentUrl || '#'}
                                  className="text-blue-600 hover:underline"
                                >
                                  View Comment →
                                </a>
                              </div>
                              {/* Replies */}
                              {comment.replies && comment.replies.length > 0 && (
                                <div className="mt-2 ml-4 border-l-2 border-gray-200 pl-3 space-y-2">
                                  {comment.replies.slice(0, 2).map((reply: any, replyIdx: number) => (
                                    <div key={replyIdx} className="text-sm">
                                      <span className="font-medium">
                                        {reply.ownerUsername || reply.author}
                                      </span>
                                      <span className="text-gray-600 ml-2">{reply.text}</span>
                                    </div>
                                  ))}
                                  {comment.replies.length > 2 && (
                                    <div className="text-xs text-gray-500">
                                      ... and {comment.replies.length - 2} more replies
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Latest Posts Grid */}
              {creator?.latestPosts && creator.latestPosts.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-700 block mb-3">
                    Latest Posts ({creator.latestPosts.length}):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {creator.latestPosts.map((post: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        {post.caption && (
                          <div className="text-sm text-gray-700 mb-2 line-clamp-3">
                            {post.caption}
                          </div>
                        )}
                        {post.type && (
                          <div className="text-xs text-gray-500 mb-2">Type: {post.type}</div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          {post.likes !== undefined && (
                            <span>{post.likes.toLocaleString()} ❤️</span>
                          )}
                          {post.comments !== undefined && (
                            <span>{post.comments.toLocaleString()} 💬</span>
                          )}
                        </div>
                        {post.url && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                          >
                            View Post →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full JSON View */}
          <details className="bg-white rounded-lg shadow p-6">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 mb-2">
              View Full JSON Data
            </summary>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-sm mt-2">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
