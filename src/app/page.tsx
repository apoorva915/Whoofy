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
  audio: {
    track: {
      title: string;
      artist: string;
    } | null;
    confidence: number;
  } | null;
  transcription: {
    transcript: string;
    language: string;
    segments: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
    }>;
    processingTime: number;
  } | null;
  sentiment: {
    transcript: {
      sentiment: 'positive' | 'negative' | 'neutral';
      score: number;
      positiveCount: number;
      negativeCount: number;
      wordCount: number;
    };
    caption: {
      sentiment: 'positive' | 'negative' | 'neutral';
      score: number;
      positiveCount: number;
      negativeCount: number;
      wordCount: number;
    };
    combined: {
      sentiment: 'positive' | 'negative' | 'neutral';
      score: number;
      positiveCount: number;
      negativeCount: number;
      wordCount: number;
      confidence: number;
    };
    processingTime: number;
  } | null;
  vision: {
    storagePath: string | null;
    visualSummary: {
      uniqueObjects: string[];
      brandsDetected: Array<{
        name: string;
        confidence: number;
        totalFrames: number;
        totalVisibleSeconds?: number;
      }>;
      targetBrandConfirmation: {
        detected: boolean;
        message: string;
        confidence: number;
        detectedInFrames: number;
        totalVisibleSeconds?: number;
      };
      visualSentiment: {
        sentiment: 'positive' | 'negative' | 'neutral';
        score: number;
        reasoning: string;
        confidence: number;
      };
      frameAnalyses: Array<{
        timestamp: number;
        objects: string[];
        brands: Array<{
          name: string;
          confidence: number;
        }>;
      }>;
    };
  } | null;
  processingTime: number;
}

export default function Home() {
  const [reelUrl, setReelUrl] = useState('');
  const [targetBrandName, setTargetBrandName] = useState('Cadbury');
  const [productNames, setProductNames] = useState('Dairy Milk, Silk Brownie');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Parse product names from comma-separated string
      const productNamesArray = productNames
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);

      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          reelUrl,
          targetBrandName: targetBrandName.trim() || undefined,
          productNames: productNamesArray.length > 0 ? productNamesArray : undefined,
        }),
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
              Reel URL <span style={{ color: '#d32f2f' }}>*</span>
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

          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="targetBrandName" style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Target Brand Name
            </label>
            <input
              id="targetBrandName"
              type="text"
              value={targetBrandName}
              onChange={(e) => setTargetBrandName(e.target.value)}
              placeholder="e.g., Cadbury, Nike, Pepsi"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              The main brand name to detect (e.g., "Cadbury")
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="productNames" style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Product Names (comma-separated)
            </label>
            <input
              id="productNames"
              type="text"
              value={productNames}
              onChange={(e) => setProductNames(e.target.value)}
              placeholder="e.g., Dairy Milk, Silk Brownie, Air Max"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Specific product names to detect, separated by commas (e.g., "Dairy Milk, Silk Brownie")
            </div>
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

              {/* Audio Recognition */}
              {result.audio && result.audio.track && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Audio Recognition</h3>
                  <p><strong>Track:</strong> {result.audio.track.title}</p>
                  <p><strong>Artist:</strong> {result.audio.track.artist}</p>
                  <p><strong>Confidence:</strong> {(result.audio.confidence * 100).toFixed(1)}%</p>
                </div>
              )}

              {result.transcription && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Transcription (Local Whisper)</h3>
                  <p style={{ marginBottom: 0 }}>
                    <strong>Language:</strong> {result.transcription.language}
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    <strong>Processing Time:</strong> {(result.transcription.processingTime / 1000).toFixed(1)}s
                  </p>
                  <div style={{ background: '#fafafa', padding: '10px', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', fontSize: '14px', color: '#111', whiteSpace: 'pre-wrap' }}>
                    {result.transcription.transcript || <em>No transcript available</em>}
                  </div>
                  {result.transcription.segments.length > 0 && (
                    <div style={{ fontSize: '13px', color: '#555' }}>
                      <strong>Segments:</strong>
                      <ul style={{ paddingLeft: '18px', margin: '8px 0 0', maxHeight: '120px', overflowY: 'auto', listStyle: 'disc' }}>
                        {result.transcription.segments.slice(0, 3).map((seg, idx) => (
                          <li key={idx}>
                            <span style={{ fontWeight: 600 }}>
                              {seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s
                            </span>
                            : {seg.text || <em>…</em>}
                          </li>
                        ))}
                        {result.transcription.segments.length > 3 && (
                          <li>+ {result.transcription.segments.length - 3} more segments</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Sentiment Analysis */}
              {result.sentiment && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', gridColumn: '1 / -1' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Sentiment Analysis</h3>
                  
                  {/* Combined Sentiment (Main) */}
                  <div style={{ 
                    marginBottom: '15px', 
                    padding: '10px', 
                    borderRadius: '4px',
                    backgroundColor: result.sentiment.combined.sentiment === 'positive' ? '#e8f5e9' :
                                    result.sentiment.combined.sentiment === 'negative' ? '#ffebee' : '#f5f5f5'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '14px' }}>Overall Sentiment:</strong>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        backgroundColor: result.sentiment.combined.sentiment === 'positive' ? '#4caf50' :
                                        result.sentiment.combined.sentiment === 'negative' ? '#f44336' : '#9e9e9e',
                        color: 'white'
                      }}>
                        {result.sentiment.combined.sentiment}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                    {/* Transcript Sentiment */}
                    <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                      <strong style={{ fontSize: '13px' }}>Transcript Sentiment:</strong>
                      <div style={{ marginTop: '5px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: result.sentiment.transcript.sentiment === 'positive' ? '#c8e6c9' :
                                          result.sentiment.transcript.sentiment === 'negative' ? '#ffcdd2' : '#e0e0e0',
                          color: result.sentiment.transcript.sentiment === 'positive' ? '#2e7d32' :
                                 result.sentiment.transcript.sentiment === 'negative' ? '#c62828' : '#616161'
                        }}>
                          {result.sentiment.transcript.sentiment}
                        </span>
                      </div>
                    </div>

                    {/* Caption Sentiment */}
                    <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                      <strong style={{ fontSize: '13px' }}>Caption Sentiment:</strong>
                      <div style={{ marginTop: '5px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: result.sentiment.caption.sentiment === 'positive' ? '#c8e6c9' :
                                          result.sentiment.caption.sentiment === 'negative' ? '#ffcdd2' : '#e0e0e0',
                          color: result.sentiment.caption.sentiment === 'positive' ? '#2e7d32' :
                                 result.sentiment.caption.sentiment === 'negative' ? '#c62828' : '#616161'
                        }}>
                          {result.sentiment.caption.sentiment}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Publicity Assessment */}
                  <div style={{ 
                    marginTop: '15px', 
                    padding: '10px', 
                    borderRadius: '4px',
                    backgroundColor: result.sentiment.combined.sentiment === 'positive' ? '#e3f2fd' : 
                                    result.sentiment.combined.sentiment === 'negative' ? '#fff3e0' : '#f5f5f5',
                    border: `1px solid ${result.sentiment.combined.sentiment === 'positive' ? '#2196f3' : 
                                            result.sentiment.combined.sentiment === 'negative' ? '#ff9800' : '#9e9e9e'}`
                  }}>
                    <strong style={{ fontSize: '13px' }}>Publicity Assessment:</strong>
                    <p style={{ marginTop: '5px', fontSize: '13px', color: '#333' }}>
                      {result.sentiment.combined.sentiment === 'positive' 
                        ? '✅ This reel provides GOOD publicity for the product. The sentiment is positive overall.'
                        : result.sentiment.combined.sentiment === 'negative'
                        ? '⚠️ This reel may provide POOR publicity for the product. The sentiment is negative overall.'
                        : '➖ This reel provides NEUTRAL publicity for the product. The sentiment is neither strongly positive nor negative.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Vision Analysis */}
              {result.vision && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', gridColumn: '1 / -1' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Vision Analysis (YOLO + OCR)</h3>
                  
                  {/* Brand Confirmation - Most Important */}
                  {result.vision.visualSummary.targetBrandConfirmation && (
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '15px', 
                      borderRadius: '4px',
                      backgroundColor: result.vision.visualSummary.targetBrandConfirmation.detected ? '#e8f5e9' : '#ffebee',
                      border: `2px solid ${result.vision.visualSummary.targetBrandConfirmation.detected ? '#4caf50' : '#f44336'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '15px', color: '#333' }}>
                          Brand Detection Confirmation:
                        </strong>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: result.vision.visualSummary.targetBrandConfirmation.detected ? '#4caf50' : '#f44336',
                          color: 'white'
                        }}>
                          {result.vision.visualSummary.targetBrandConfirmation.detected ? '✓ DETECTED' : '✗ NOT DETECTED'}
                        </span>
                      </div>
                      <p style={{ 
                        margin: '8px 0 0 0', 
                        fontSize: '14px', 
                        color: '#333',
                        fontWeight: '500'
                      }}>
                        {result.vision.visualSummary.targetBrandConfirmation.message}
                      </p>
                      {result.vision.visualSummary.targetBrandConfirmation.detected && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                          Confidence: {(result.vision.visualSummary.targetBrandConfirmation.confidence * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visual Sentiment - Publicity Assessment */}
                  {result.vision.visualSummary.visualSentiment && (
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '15px', 
                      borderRadius: '4px',
                      backgroundColor: result.vision.visualSummary.visualSentiment.sentiment === 'positive' ? '#e3f2fd' : 
                                      result.vision.visualSummary.visualSentiment.sentiment === 'negative' ? '#ffebee' : '#f5f5f5',
                      border: `2px solid ${result.vision.visualSummary.visualSentiment.sentiment === 'positive' ? '#2196f3' : 
                                              result.vision.visualSummary.visualSentiment.sentiment === 'negative' ? '#f44336' : '#9e9e9e'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <strong style={{ fontSize: '15px', color: '#333' }}>
                          Visual Publicity Assessment:
                        </strong>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          backgroundColor: result.vision.visualSummary.visualSentiment.sentiment === 'positive' ? '#4caf50' :
                                          result.vision.visualSummary.visualSentiment.sentiment === 'negative' ? '#f44336' : '#9e9e9e',
                          color: 'white'
                        }}>
                          {result.vision.visualSummary.visualSentiment.sentiment}
                        </span>
                      </div>
                      <p style={{ 
                        margin: '8px 0', 
                        fontSize: '13px', 
                        color: '#333',
                        lineHeight: '1.5'
                      }}>
                        {result.vision.visualSummary.visualSentiment.reasoning}
                      </p>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                        Score: {result.vision.visualSummary.visualSentiment.score.toFixed(2)} | 
                        Confidence: {(result.vision.visualSummary.visualSentiment.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  )}
                  
                  {/* Objects Detected */}
                  {result.vision.visualSummary.uniqueObjects.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                        Objects Detected ({result.vision.visualSummary.uniqueObjects.length}):
                      </strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {result.vision.visualSummary.uniqueObjects.map((obj, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              backgroundColor: '#e3f2fd',
                              color: '#1976d2',
                              fontWeight: '500',
                            }}
                          >
                            {obj}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Brands Detected */}
                  {result.vision.visualSummary.brandsDetected.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                        Brands/Logos Detected ({result.vision.visualSummary.brandsDetected.length}):
                      </strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {result.vision.visualSummary.brandsDetected.map((brand, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '10px',
                              borderRadius: '4px',
                              backgroundColor: '#f5f5f5',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: '13px' }}>{brand.name}</strong>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                                Visible in {brand.totalFrames} frame{brand.totalFrames !== 1 ? 's' : ''}
                                {brand.totalVisibleSeconds !== undefined && ` (${brand.totalVisibleSeconds.toFixed(1)}s)`}
                              </div>
                            </div>
                            <div
                              style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: brand.confidence >= 0.7 ? '#c8e6c9' : brand.confidence >= 0.4 ? '#fff9c4' : '#ffcdd2',
                                color: brand.confidence >= 0.7 ? '#2e7d32' : brand.confidence >= 0.4 ? '#f57f17' : '#c62828',
                              }}
                            >
                              {(brand.confidence * 100).toFixed(0)}% confidence
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Frame-by-Frame Analysis */}
                  {result.vision.visualSummary.frameAnalyses.length > 0 && (
                    <div>
                      <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                        Frame-by-Frame Analysis ({result.vision.visualSummary.frameAnalyses.length} frames):
                      </strong>
                      <div style={{ 
                        maxHeight: '300px', 
                        overflowY: 'auto', 
                        border: '1px solid #e0e0e0', 
                        borderRadius: '4px',
                        padding: '10px',
                        backgroundColor: '#fafafa'
                      }}>
                        {result.vision.visualSummary.frameAnalyses.slice(0, 10).map((frame, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '8px',
                              marginBottom: '8px',
                              backgroundColor: 'white',
                              borderRadius: '4px',
                              border: '1px solid #e0e0e0',
                            }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#555' }}>
                              Frame at {frame.timestamp.toFixed(1)}s
                            </div>
                            {frame.objects.length > 0 && (
                              <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                                <strong>Objects:</strong> {frame.objects.join(', ')}
                              </div>
                            )}
                            {frame.brands.length > 0 && (
                              <div style={{ fontSize: '11px', color: '#666' }}>
                                <strong>Brands:</strong>{' '}
                                {frame.brands.map((b, i) => (
                                  <span key={i}>
                                    {b.name} ({(b.confidence * 100).toFixed(0)}%)
                                    {i < frame.brands.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                            {frame.objects.length === 0 && frame.brands.length === 0 && (
                              <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>
                                No objects or brands detected
                              </div>
                            )}
                          </div>
                        ))}
                        {result.vision.visualSummary.frameAnalyses.length > 10 && (
                          <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', padding: '8px' }}>
                            + {result.vision.visualSummary.frameAnalyses.length - 10} more frames
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {result.vision.visualSummary.uniqueObjects.length === 0 && 
                   result.vision.visualSummary.brandsDetected.length === 0 && (
                    <div style={{ padding: '15px', textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
                      No objects or brands detected in video frames
                    </div>
                  )}
                </div>
              )}
            </div>

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
