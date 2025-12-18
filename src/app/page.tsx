'use client';

import { useState } from 'react';

interface VerificationResult {
  reelUrl: string;
  video: {
    id: string;
    duration: number;
    frameCount: number;
    frames: string[];
  };
  metadata: {
    caption: string | null;
    likes: number;
    comments: number;
    views: number | null;
    timestamp: Date;
  } | null;
  creator: {
    username: string;
    followers: number;
    verified: boolean;
    bio: string | null;
  } | null;
  transcription: {
    text: string;
    language: string;
    segmentCount: number;
  } | null;
  audio: {
    track: {
      title: string;
      artist: string;
    } | null;
    confidence: number;
  } | null;
  visualAnalysis: {
    uniqueObjects: string[];
    brandsDetected: {
      name: string;
      confidence: number;
      totalFrames: number;
      totalVisibleSeconds?: number;
    }[];
    frameCount: number;
    frameAnalyses: Array<{
      timestamp: number;
      objectCount: number;
      brandCount: number;
      objects: string[];
      brands: Array<{ name: string; confidence: number }>;
    }>;
  } | null;
  processingTime: number;
}

export default function Home() {
  const [reelUrl, setReelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reelUrl }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Verification failed');
      }

      setResult(data.data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', padding: '20px', background: '#f5f5f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '30px', color: '#333' }}>Whoofy - Reel Verification</h1>

        <form onSubmit={handleSubmit} style={{ marginBottom: '30px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="reelUrl" style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Reel URL
            </label>
            <input
              id="reelUrl"
              type="url"
              value={reelUrl}
              onChange={(e) => setReelUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            {loading ? 'Processing...' : 'Verify Reel'}
          </button>
        </form>

        {error && (
          <div style={{ background: '#fee', padding: '15px', borderRadius: '4px', marginBottom: '20px', color: '#c33' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Verification Results</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {/* Video Info */}
              <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                <h3 style={{ marginTop: 0, fontSize: '16px' }}>Video Information</h3>
                <p><strong>Duration:</strong> {result.video.duration.toFixed(1)}s</p>
                <p><strong>Frames Extracted:</strong> {result.video.frameCount}</p>
                <p><strong>Processing Time:</strong> {(result.processingTime / 1000).toFixed(1)}s</p>
              </div>

              {/* Metadata */}
              {result.metadata && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Reel Metadata</h3>
                  <p><strong>Likes:</strong> {result.metadata.likes.toLocaleString()}</p>
                  <p><strong>Comments:</strong> {result.metadata.comments.toLocaleString()}</p>
                  {result.metadata.views && (
                    <p><strong>Views:</strong> {result.metadata.views.toLocaleString()}</p>
                  )}
                  {result.metadata.caption && (
                    <div style={{ marginTop: '10px' }}>
                      <strong>Caption:</strong>
                      <p style={{ marginTop: '5px', fontSize: '14px', color: '#666' }}>{result.metadata.caption}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Creator Info */}
              {result.creator && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Creator</h3>
                  <p><strong>Username:</strong> @{result.creator.username}</p>
                  <p><strong>Followers:</strong> {result.creator.followers.toLocaleString()}</p>
                  <p><strong>Verified:</strong> {result.creator.verified ? 'Yes' : 'No'}</p>
                  {result.creator.bio && (
                    <div style={{ marginTop: '10px' }}>
                      <strong>Bio:</strong>
                      <p style={{ marginTop: '5px', fontSize: '14px', color: '#666' }}>{result.creator.bio}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Transcription */}
              {result.transcription && result.transcription.text && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', gridColumn: '1 / -1' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Transcription</h3>
                  <p><strong>Language:</strong> {result.transcription.language}</p>
                  <p><strong>Segments:</strong> {result.transcription.segmentCount}</p>
                  <div style={{ marginTop: '10px', padding: '10px', background: '#f9f9f9', borderRadius: '4px' }}>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>{result.transcription.text}</p>
                  </div>
                </div>
              )}

              {/* Audio Recognition */}
              {result.audio && result.audio.track && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Audio Recognition</h3>
                  <p><strong>Track:</strong> {result.audio.track.title}</p>
                  <p><strong>Artist:</strong> {result.audio.track.artist}</p>
                  <p><strong>Confidence:</strong> {(result.audio.confidence * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>

            {/* Visual Analysis */}
            {result.visualAnalysis && (
              <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '20px', borderRadius: '4px', background: '#f9f9f9' }}>
                <h3 style={{ marginTop: 0, fontSize: '18px', color: '#333' }}>Visual Analysis</h3>
                
                {/* Unique Objects */}
                <div style={{ marginTop: '15px' }}>
                  <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>Objects Detected ({result.visualAnalysis.uniqueObjects.length})</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {result.visualAnalysis.uniqueObjects.map((obj, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '5px 10px',
                          background: '#e3f2fd',
                          borderRadius: '12px',
                          fontSize: '13px',
                          color: '#1976d2',
                        }}
                      >
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Brands Detected */}
                {result.visualAnalysis.brandsDetected.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>Brands Detected ({result.visualAnalysis.brandsDetected.length})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                      {result.visualAnalysis.brandsDetected.map((brand, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '12px',
                            background: 'white',
                            borderRadius: '6px',
                            border: '1px solid #ddd',
                          }}
                        >
                          <p style={{ margin: '0 0 5px 0', fontWeight: '600', fontSize: '14px' }}>{brand.name}</p>
                          <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#666' }}>
                            Confidence: {(brand.confidence * 100).toFixed(1)}%
                          </p>
                          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                            Visible in {brand.totalFrames} frame{brand.totalFrames !== 1 ? 's' : ''}
                            {brand.totalVisibleSeconds && ` (${brand.totalVisibleSeconds.toFixed(1)}s)`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Frame Analyses Preview */}
                {result.visualAnalysis.frameAnalyses.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>Frame Analysis Preview</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                      {result.visualAnalysis.frameAnalyses.map((frame, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '12px',
                            background: 'white',
                            borderRadius: '6px',
                            border: '1px solid #ddd',
                          }}
                        >
                          <p style={{ margin: '0 0 8px 0', fontWeight: '600', fontSize: '13px' }}>
                            Frame at {frame.timestamp.toFixed(1)}s
                          </p>
                          {frame.objects.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#666' }}>Objects:</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {frame.objects.slice(0, 5).map((obj, objIdx) => (
                                  <span
                                    key={objIdx}
                                    style={{
                                      padding: '3px 8px',
                                      background: '#f0f0f0',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                    }}
                                  >
                                    {obj}
                                  </span>
                                ))}
                                {frame.objects.length > 5 && (
                                  <span style={{ fontSize: '11px', color: '#999' }}>+{frame.objects.length - 5} more</span>
                                )}
                              </div>
                            </div>
                          )}
                          {frame.brands.length > 0 && (
                            <div>
                              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#666' }}>Brands:</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {frame.brands.map((brand, brandIdx) => (
                                  <span
                                    key={brandIdx}
                                    style={{
                                      padding: '3px 8px',
                                      background: '#e3f2fd',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                      color: '#1976d2',
                                    }}
                                  >
                                    {brand.name} ({(brand.confidence * 100).toFixed(0)}%)
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {result.visualAnalysis.frameCount > result.visualAnalysis.frameAnalyses.length && (
                      <p style={{ marginTop: '10px', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                        Showing first {result.visualAnalysis.frameAnalyses.length} of {result.visualAnalysis.frameCount} analyzed frames
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Frames */}
            {result.video.frames.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '16px' }}>Extracted Frames ({result.video.frames.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginTop: '10px' }}>
                  {result.video.frames.map((frame, idx) => (
                    <div key={idx} style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                      <img
                        src={`/api/frames?path=${encodeURIComponent(frame)}`}
                        alt={`Frame ${idx + 1}`}
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                        onError={(e) => {
                          console.error('Frame load error:', frame);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
