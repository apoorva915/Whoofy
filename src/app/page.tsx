'use client';

import { useState } from 'react';

interface ProfileData {
  reelUrl: string;
  metadata: {
    caption: string | null;
    transcript: string | null;
    likes: number;
    comments: number;
    views: number | null;
    shares: number | null;
    timestamp: Date;
    duration: number | null;
    hashtags: string[];
    mentions: string[];
    taggedUsers: string[];
    videoUrl: string | null;
    thumbnailUrl: string | null;
    musicInfo: {
      artist: string | null;
      song: string | null;
      originalAudio: boolean;
    } | null;
    isSponsored: boolean;
    commentsDisabled: boolean;
    coAuthors: string[];
    mediaDimensions: {
      width: number | null;
      height: number | null;
    } | null;
    comments: Array<{
      id?: string;
      commentUrl?: string;
      text: string;
      author: string;
      ownerUsername?: string;
      ownerProfilePicUrl?: string;
      timestamp: Date;
      likes?: number;
      likesCount?: number;
      repliesCount?: number;
      replies?: Array<{
        id?: string;
        text: string;
        author: string;
        ownerUsername?: string;
        ownerProfilePicUrl?: string;
        timestamp: Date;
        likes?: number;
        likesCount?: number;
        repliesCount?: number;
      }>;
      owner?: {
        id?: string;
        username?: string;
        fullName?: string;
        profilePicUrl?: string;
        isVerified?: boolean;
        isPrivate?: boolean;
      };
    }>;
    // Additional fields from Post Scraper
    postType?: string | null;
    isPinned?: boolean | null;
    isPaidPartnership?: boolean | null;
    childPosts?: Array<{
      id: string;
      url: string;
      imageUrl: string | null;
      caption: string | null;
    }>;
    imageUrls?: string[];
    imageAltText?: string[];
    imageDimensions?: Array<{
      width: number | null;
      height: number | null;
    }>;
    replyCount?: number | null;
    postOwnerInfo?: {
      username: string | null;
      fullName: string | null;
      profilePicUrl: string | null;
      followers?: number | null;
      following?: number | null;
    } | null;
  } | null;
  creator: {
    username: string;
    followers: number;
    verified: boolean;
    bio: string | null;
    accountType?: string;
    following?: number;
    mediaCount?: number;
    profilePictureUrl?: string | null;
    website?: string | null;
    // Additional fields from Profile Scraper
    profileId?: string | null;
    location?: string | null;
    joinDate?: Date | null;
    videoCount?: number | null;
    highlightReelsCount?: number | null;
    businessCategory?: string | null;
    relatedProfiles?: string[];
    latestPosts?: Array<{
      id: string;
      url: string;
      caption: string | null;
      likes: number;
      comments: number;
      timestamp: Date;
      type: string;
    }>;
    igtvVideoCount?: number | null;
    usernameChangeCount?: number | null;
    isRecentlyJoined?: boolean | null;
    verifiedDate?: Date | null;
    facebookId?: string | null;
  } | null;
  sources?: {
    reel: string[];
    creator: string[];
  };
}

interface TranscriptionData {
  reelUrl: string;
  videoId: string;
  videoPath: string;
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
}

interface AnalysisData {
  reelUrl: string;
  video: {
    id: string;
    duration: number;
    frameCount: number;
    frames: string[];
  };
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
      visualSimilaritySummary?: {
        averageSimilarity: number;
        maxSimilarity: number;
        matchedFrames: number;
        totalFrames: number;
        visibleSeconds?: number;
        referenceImageCount?: number;
      };
      frameAnalyses: Array<{
        timestamp: number;
        objects: string[];
        brands: Array<{
          name: string;
          confidence: number;
        }>;
        visualSimilarity?: {
          similarity: number;
          match: boolean;
          confidence: 'high' | 'medium' | 'low' | 'none';
          referenceImageIndex?: number;
        };
      }>;
    };
  } | null;
}

export default function Home() {
  const [reelUrl, setReelUrl] = useState('');
  const [targetBrandName, setTargetBrandName] = useState('Cadbury');
  const [productNames, setProductNames] = useState('Dairy Milk, Silk Brownie');
  const [productImages, setProductImages] = useState<File[]>([]);
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'data' | 'transcription' | 'analysis'>('data');
  const [loadingData, setLoadingData] = useState(false);
  const [loadingTranscription, setLoadingTranscription] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  
  // Results
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [transcriptionData, setTranscriptionData] = useState<TranscriptionData | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  
  // Gemini Sentiment Analysis
  const [geminiSentiment, setGeminiSentiment] = useState<{
    caption: { sentiment: string; confidence: number; reasoning: string; language: string; languageConfidence?: number };
    transcript: { sentiment: string; confidence: number; reasoning: string; language: string; languageConfidence?: number };
    isPositivePublicity: boolean;
    overallReasoning: string;
    processingTimeMs: number;
  } | null>(null);
  const [loadingGeminiSentiment, setLoadingGeminiSentiment] = useState(false);
  
  // Niche Analysis
  const [nicheAnalysis, setNicheAnalysis] = useState<{
    niches: string[];
    confidence: number;
    reasoning: string;
    processingTimeMs: number;
  } | null>(null);
  const [loadingNicheAnalysis, setLoadingNicheAnalysis] = useState(false);
  
  // Engagement Verification
  const [engagementVerification, setEngagementVerification] = useState<{
    overallAuthentic: boolean;
    overallScore: number;
    overallIssues: string[];
    commentAnalysis: {
      totalComments: number;
      suspiciousComments: number;
      suspiciousCommentPercentage: number;
      botLikelihood: number;
      issues: any;
      recommendations: string[];
    } | null;
    engagementAnalysis: {
      isAuthentic: boolean;
      authenticityScore: number;
      promotionTimestamp: Date | null;
      issues: any;
      metrics: any;
      recommendations: string[];
    } | null;
    promotionTimestamp: Date | null;
  } | null>(null);
  const [loadingEngagementVerification, setLoadingEngagementVerification] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [framesExpanded, setFramesExpanded] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setProductImages(files);
      const previews: string[] = [];
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          previews.push(reader.result as string);
          if (previews.length === files.length) {
            setProductImagePreviews(previews);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    const newImages = productImages.filter((_, i) => i !== index);
    const newPreviews = productImagePreviews.filter((_, i) => i !== index);
    setProductImages(newImages);
    setProductImagePreviews(newPreviews);
  };

  // Data Tab: Profile Scraping
  const handleDataScraping = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingData(true);
    setError(null);
    setGeminiSentiment(null); // Reset sentiment when scraping new data
    setNicheAnalysis(null); // Reset niche analysis when scraping new data
    setEngagementVerification(null); // Reset engagement verification when scraping new data

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reelUrl }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Profile scraping failed');
      }

      setProfileData(data.data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoadingData(false);
    }
  };

  // Gemini Sentiment Analysis
  const handleGeminiSentimentAnalysis = async () => {
    if (!profileData?.metadata) {
      setError('Please scrape data first');
      return;
    }

    const caption = profileData.metadata.caption;
    const transcript = profileData.metadata.transcript;

    if (!caption && !transcript) {
      setError('No caption or transcript available for sentiment analysis');
      return;
    }

    setLoadingGeminiSentiment(true);
    setError(null);

    try {
      const response = await fetch('/api/sentiment/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption: caption || null,
          transcript: transcript || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Sentiment analysis failed');
      }

      setGeminiSentiment(data.data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during sentiment analysis');
    } finally {
      setLoadingGeminiSentiment(false);
    }
  };

  // Niche Analysis
  const handleNicheAnalysis = async () => {
    if (!profileData?.creator) {
      setError('Please scrape data first to get creator profile');
      return;
    }

    const bio = profileData.creator.bio;
    const latestPosts = profileData.creator.latestPosts || [];

    if (!bio && latestPosts.length === 0) {
      setError('No bio or posts available for niche analysis');
      return;
    }

    setLoadingNicheAnalysis(true);
    setError(null);

    try {
      // Prepare posts data for analysis
      const postsData = latestPosts.slice(0, 5).map(post => ({
        caption: post.caption || null,
        type: post.type || 'unknown',
        likes: post.likes || 0,
        comments: post.comments || 0,
      }));

      const response = await fetch('/api/creators/niche-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bio: bio || null,
          posts: postsData,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Niche analysis failed');
      }

      setNicheAnalysis(data.data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during niche analysis');
    } finally {
      setLoadingNicheAnalysis(false);
    }
  };

  // Engagement Verification
  const handleEngagementVerification = async () => {
    if (!profileData?.metadata) {
      setError('Please scrape data first to get reel metadata');
      return;
    }

    const comments = profileData.metadata.comments || [];
    const engagement = {
      timestamp: profileData.metadata.timestamp,
      likes: profileData.metadata.likes || 0,
      views: profileData.metadata.views || null,
      comments: profileData.metadata.comments?.length || 0,
      shares: profileData.metadata.shares || null,
    };
    const followerCount = profileData.creator?.followers || null;

    if (comments.length === 0 && !engagement.likes) {
      setError('No comments or engagement data available for verification');
      return;
    }

    setLoadingEngagementVerification(true);
    setError(null);

    try {
      // Prepare historical engagement data from latest posts (if available)
      const historicalEngagement = profileData.creator?.latestPosts?.slice(0, 10).map(post => ({
        timestamp: post.timestamp,
        likes: post.likes || 0,
        comments: post.comments || 0,
      })) || [];

      const response = await fetch('/api/verify/engagement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comments: comments.map(comment => ({
            id: comment.id,
            text: comment.text,
            author: comment.author,
            ownerUsername: comment.ownerUsername,
            timestamp: comment.timestamp,
            likes: comment.likes || comment.likesCount,
            replies: comment.replies || [],
          })),
          engagement,
          followerCount,
          historicalEngagement,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Engagement verification failed');
      }

      setEngagementVerification(data.data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during engagement verification');
    } finally {
      setLoadingEngagementVerification(false);
    }
  };

  // Transcription Tab: Transcription & Sentiment Analysis
  const handleTranscription = async () => {
    if (!reelUrl) {
      setError('Please enter a reel URL first');
      return;
    }
    
    setLoadingTranscription(true);
    setError(null);

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          reelUrl,
          caption: profileData?.metadata?.caption || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Transcription failed');
      }

      setTranscriptionData(data.data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoadingTranscription(false);
    }
  };

  // Analysis Tab: Video Analysis
  const handleAnalysis = async () => {
    if (!reelUrl) {
      setError('Please enter a reel URL first');
      return;
    }
    
    setLoadingAnalysis(true);
    setError(null);

    try {
      // Parse product names from comma-separated string
      const productNamesArray = productNames
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);

      // Convert images to base64 if provided
      let productImagesBase64: string[] | undefined = undefined;
      if (productImages.length > 0) {
        productImagesBase64 = await Promise.all(
          productImages.map((file) => 
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            })
          )
        );
      }

      // Build request body - reuse video data if transcription was run, otherwise let API download it
      const requestBody: any = {
        reelUrl,
        targetBrandName: targetBrandName.trim() || undefined,
        productNames: productNamesArray.length > 0 ? productNamesArray : undefined,
        productImages: productImagesBase64,
      };

      // If transcription data exists, reuse the video to avoid re-downloading
      if (transcriptionData?.videoId && transcriptionData?.videoPath) {
        requestBody.videoId = transcriptionData.videoId;
        requestBody.videoPath = transcriptionData.videoPath;
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Video analysis failed');
      }

      setAnalysisData(data.data);
      setFramesExpanded(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const resetWorkflow = () => {
    setProfileData(null);
    setTranscriptionData(null);
    setAnalysisData(null);
    setGeminiSentiment(null);
    setNicheAnalysis(null);
    setEngagementVerification(null);
    setError(null);
    setReelUrl('');
  };

  return (
    <main style={{ minHeight: '100vh', padding: '20px', background: '#f5f5f5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '30px', color: '#333' }}>Whoofy - Reel Verification</h1>

        {/* Reel URL Input (Shared across all tabs) */}
        <div style={{ marginBottom: '20px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <label htmlFor="reelUrl" style={{ display: 'block', marginBottom: '10px', fontWeight: '600', fontSize: '16px' }}>
            Reel URL <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <input
            id="reelUrl"
            type="url"
            value={reelUrl}
            onChange={(e) => setReelUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/..."
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0' }}>
            <button
              onClick={() => setActiveTab('data')}
              style={{
                flex: 1,
                padding: '15px 20px',
                background: activeTab === 'data' ? '#0070f3' : 'transparent',
                color: activeTab === 'data' ? 'white' : '#666',
                border: 'none',
                borderBottom: activeTab === 'data' ? '3px solid #0070f3' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: activeTab === 'data' ? '600' : '400',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              📊 Data Scraping
              {profileData && (
                <span style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#4caf50',
                }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('transcription')}
              style={{
                flex: 1,
                padding: '15px 20px',
                background: activeTab === 'transcription' ? '#0070f3' : 'transparent',
                color: activeTab === 'transcription' ? 'white' : '#666',
                border: 'none',
                borderBottom: activeTab === 'transcription' ? '3px solid #0070f3' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: activeTab === 'transcription' ? '600' : '400',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              🎤 Transcription (Whisper Local)
              {transcriptionData && (
                <span style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#4caf50',
                }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              style={{
                flex: 1,
                padding: '15px 20px',
                background: activeTab === 'analysis' ? '#0070f3' : 'transparent',
                color: activeTab === 'analysis' ? 'white' : '#666',
                border: 'none',
                borderBottom: activeTab === 'analysis' ? '3px solid #0070f3' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: activeTab === 'analysis' ? '600' : '400',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              🎬 Frame & Video Analysis
              {analysisData && (
                <span style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#4caf50',
                }} />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '20px' }}>
            {/* Data Tab */}
            {activeTab === 'data' && (
              <div>
                <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Data Scraping</h2>
                <form onSubmit={handleDataScraping}>
                  <button
                    type="submit"
                    disabled={loadingData || !reelUrl}
                    style={{
                      padding: '12px 24px',
                      background: (loadingData || !reelUrl) ? '#ccc' : '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: (loadingData || !reelUrl) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      marginRight: '10px',
                    }}
                  >
                    {loadingData ? 'Scraping Data...' : 'Scrape Profile & Reel Data'}
                  </button>
                </form>
                {profileData?.metadata && (profileData.metadata.caption || profileData.metadata.transcript) && (
                  <div style={{ marginTop: '20px' }}>
                    <button
                      onClick={handleGeminiSentimentAnalysis}
                      disabled={loadingGeminiSentiment}
                      style={{
                        padding: '12px 24px',
                        background: loadingGeminiSentiment ? '#ccc' : '#9c27b0',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loadingGeminiSentiment ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        marginRight: '10px',
                      }}
                    >
                      {loadingGeminiSentiment ? 'Analyzing Sentiment...' : '🤖 Analyze Sentiment with Gemini'}
                    </button>
                    <p style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
                      Analyze sentiment of caption and transcript using Google Gemini AI
                    </p>
                  </div>
                )}
                {profileData?.creator && (
                  <div style={{ marginTop: '20px' }}>
                    <button
                      onClick={handleNicheAnalysis}
                      disabled={loadingNicheAnalysis}
                      style={{
                        padding: '12px 24px',
                        background: loadingNicheAnalysis ? '#ccc' : '#ff9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loadingNicheAnalysis ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        marginRight: '10px',
                      }}
                    >
                      {loadingNicheAnalysis ? 'Analyzing Niche...' : '🎯 Analyze Creator Niche'}
                    </button>
                    <p style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
                      Analyze creator niche from bio and last 5 posts using Google Gemini AI
                    </p>
                  </div>
                )}
                {profileData?.metadata && (
                  <div style={{ marginTop: '20px' }}>
                    <button
                      onClick={handleEngagementVerification}
                      disabled={loadingEngagementVerification}
                      style={{
                        padding: '12px 24px',
                        background: loadingEngagementVerification ? '#ccc' : '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loadingEngagementVerification ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                      }}
                    >
                      {loadingEngagementVerification ? 'Verifying Engagement...' : '🔍 Verify Engagement Authenticity'}
                    </button>
                    <p style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
                      Detect fake views, bot comments, and engagement manipulation. Checks for duplicate comments, emoji-only comments, and suspicious engagement patterns.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Transcription Tab */}
            {activeTab === 'transcription' && (
              <div>
                <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Transcription & Sentiment Analysis</h2>
                <button
                  onClick={handleTranscription}
                  disabled={loadingTranscription || !reelUrl}
                  style={{
                    padding: '12px 24px',
                    background: (loadingTranscription || !reelUrl) ? '#ccc' : '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (loadingTranscription || !reelUrl) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  {loadingTranscription ? 'Transcribing & Analyzing...' : 'Start Transcription & Sentiment Analysis'}
                </button>
              </div>
            )}

            {/* Analysis Tab */}
            {activeTab === 'analysis' && (
              <div>
                <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Frame & Video Analysis</h2>
                
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
                    disabled={loadingAnalysis}
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
                  <label htmlFor="productNames" style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Product Names (comma-separated)
                  </label>
                  <input
                    id="productNames"
                    type="text"
                    value={productNames}
                    onChange={(e) => setProductNames(e.target.value)}
                    placeholder="e.g., Dairy Milk, Silk Brownie"
                    disabled={loadingAnalysis}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="productImages" style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Product Images (Optional - for CLIP visual similarity)
                  </label>
                  <input
                    id="productImages"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    disabled={loadingAnalysis}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                  {productImagePreviews.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {productImagePreviews.map((preview, index) => (
                        <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                          <img 
                            src={preview} 
                            alt={`Product preview ${index + 1}`} 
                            style={{ 
                              maxWidth: '150px', 
                              maxHeight: '150px', 
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              objectFit: 'cover'
                            }} 
                          />
                          <button
                            onClick={() => removeImage(index)}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: 'bold',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAnalysis}
                  disabled={loadingAnalysis || !reelUrl}
                  style={{
                    padding: '12px 24px',
                    background: (loadingAnalysis || !reelUrl) ? '#ccc' : '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (loadingAnalysis || !reelUrl) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  {loadingAnalysis ? 'Analyzing Video...' : 'Start Video Analysis'}
                </button>
                {transcriptionData && (
                  <p style={{ marginTop: '10px', color: '#4caf50', fontSize: '14px' }}>
                    ℹ️ Will reuse video from transcription (faster). If transcription wasn't run, video will be downloaded automatically.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>


        {error && (
          <div style={{ background: '#fee', padding: '15px', borderRadius: '4px', marginBottom: '20px', color: '#c33' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Data Results */}
        {profileData && activeTab === 'data' && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>Data Scraping Results</h2>
            </div>

            {profileData.sources && (
              <div style={{ marginBottom: '15px', padding: '10px 15px', background: '#e3f2fd', borderRadius: '4px', fontSize: '13px', color: '#1976d2' }}>
                <div style={{ marginBottom: '8px', fontWeight: '600' }}>
                  📊 Data Sources (Combined Results)
              </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Reel Data:</strong>{' '}
                  {profileData.sources.reel.length > 0 ? (
                    profileData.sources.reel.map((source, idx) => (
                      <span key={idx} style={{ 
                        marginLeft: '8px', 
                        padding: '2px 8px', 
                        background: '#1976d2', 
                        color: 'white', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {source === 'apify-reel-scraper' ? '🎬 Apify Reel Scraper' : 
                         source === 'apify-post-scraper' ? '📸 Apify Post Scraper' :
                         source === 'apify-instagram-scraper' ? '📱 Apify Instagram Scraper' :
                         source === 'apify-comments-scraper' ? '💬 Apify Comments Scraper' :
                         source === 'instagram-api' ? '🔗 Instagram API' : source}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#999' }}>None</span>
                  )}
                  {profileData.sources.reel.length > 1 && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                      (Data merged from multiple sources)
                    </span>
                  )}
                </div>
                {profileData.sources.creator.length > 0 && (
                  <div>
                    <strong>Creator Profile:</strong>{' '}
                    {profileData.sources.creator.map((source, idx) => (
                      <span key={idx} style={{ 
                        marginLeft: '8px', 
                        padding: '2px 8px', 
                        background: '#4caf50', 
                        color: 'white', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {source === 'apify-profile-scraper' ? '👤 Apify Profile Scraper' :
                         source === 'apify-instagram-scraper' ? '📱 Apify Instagram Scraper' :
                         source === 'instagram-api' ? '🔗 Instagram API' : source}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {profileData.metadata && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', gridColumn: '1 / -1' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Reel Metadata</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                    <div>
                      {profileData.metadata.likes !== undefined && (
                        <p><strong>Likes:</strong> {profileData.metadata.likes.toLocaleString()}</p>
                      )}
                      {profileData.metadata.comments !== undefined && (
                        <p><strong>Comments:</strong> {profileData.metadata.comments.toLocaleString()}</p>
                      )}
                      {profileData.metadata.views !== undefined && profileData.metadata.views !== null && (
                        <p><strong>Views:</strong> {profileData.metadata.views.toLocaleString()}</p>
                      )}
                      {profileData.metadata.shares !== undefined && profileData.metadata.shares !== null && (
                        <p><strong>Shares:</strong> {profileData.metadata.shares.toLocaleString()}</p>
                      )}
                      {profileData.metadata.duration !== undefined && profileData.metadata.duration !== null && (
                        <p><strong>Duration:</strong> {profileData.metadata.duration.toFixed(1)}s</p>
                      )}
                      {profileData.metadata.timestamp && (
                        <p><strong>Posted:</strong> {new Date(profileData.metadata.timestamp).toLocaleString()}</p>
                      )}
                    </div>
                    <div>
                      {profileData.metadata.postType && (
                        <p><strong>Post Type:</strong> {profileData.metadata.postType}</p>
                      )}
                      {profileData.metadata.isPinned !== undefined && profileData.metadata.isPinned !== null && (
                        <p><strong>Pinned:</strong> {profileData.metadata.isPinned ? 'Yes' : 'No'}</p>
                      )}
                      {profileData.metadata.isSponsored && (
                        <p><strong>Sponsored:</strong> Yes</p>
                      )}
                      {profileData.metadata.isPaidPartnership !== undefined && profileData.metadata.isPaidPartnership !== null && (
                        <p><strong>Paid Partnership:</strong> {profileData.metadata.isPaidPartnership ? 'Yes' : 'No'}</p>
                      )}
                      {profileData.metadata.commentsDisabled && (
                        <p><strong>Comments:</strong> Disabled</p>
                      )}
                      {profileData.metadata.replyCount !== undefined && profileData.metadata.replyCount !== null && (
                        <p><strong>Replies:</strong> {profileData.metadata.replyCount.toLocaleString()}</p>
                      )}
                      {profileData.metadata.coAuthors && profileData.metadata.coAuthors.length > 0 && (
                        <p><strong>Co-Authors:</strong> {profileData.metadata.coAuthors.join(', ')}</p>
                      )}
                      {profileData.metadata.mediaDimensions && (
                        <p><strong>Dimensions:</strong> {profileData.metadata.mediaDimensions.width}x{profileData.metadata.mediaDimensions.height}</p>
                      )}
                    </div>
                  </div>

                  {profileData.metadata.postOwnerInfo && (
                    <div style={{ marginTop: '10px', marginBottom: '10px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
                      <strong>Post Owner Info:</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '8px' }}>
                        {profileData.metadata.postOwnerInfo.username && (
                          <p style={{ fontSize: '14px' }}>
                            <strong>Username:</strong> @{profileData.metadata.postOwnerInfo.username}
                          </p>
                        )}
                        {profileData.metadata.postOwnerInfo.fullName && (
                          <p style={{ fontSize: '14px' }}>
                            <strong>Full Name:</strong> {profileData.metadata.postOwnerInfo.fullName}
                          </p>
                        )}
                        {profileData.metadata.postOwnerInfo.followers !== undefined && profileData.metadata.postOwnerInfo.followers !== null && (
                          <p style={{ fontSize: '14px' }}>
                            <strong>Followers:</strong> {profileData.metadata.postOwnerInfo.followers.toLocaleString()}
                          </p>
                        )}
                        {profileData.metadata.postOwnerInfo.following !== undefined && profileData.metadata.postOwnerInfo.following !== null && (
                          <p style={{ fontSize: '14px' }}>
                            <strong>Following:</strong> {profileData.metadata.postOwnerInfo.following.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {profileData.metadata.caption && (
                    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                      <strong>Caption:</strong>
                      <p style={{ marginTop: '5px', fontSize: '14px', color: '#666', whiteSpace: 'pre-wrap' }}>{profileData.metadata.caption}</p>
                    </div>
                  )}

                  {profileData.metadata.transcript && (
                    <div style={{ marginTop: '10px', marginBottom: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <strong>Transcript (from Apify):</strong>
                      <p style={{ marginTop: '5px', fontSize: '14px', color: '#333', whiteSpace: 'pre-wrap' }}>{profileData.metadata.transcript}</p>
                </div>
              )}

                  {/* Gemini Sentiment Analysis Results */}
                  {geminiSentiment && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#f3e5f5', borderRadius: '4px', border: '2px solid #9c27b0' }}>
                      <h3 style={{ marginTop: 0, fontSize: '16px', color: '#7b1fa2' }}>
                        🤖 Gemini Sentiment Analysis
                      </h3>
                      
                      {/* Overall Positive Publicity */}
                      <div style={{ 
                        marginBottom: '20px', 
                        padding: '15px', 
                        borderRadius: '4px',
                        backgroundColor: geminiSentiment.isPositivePublicity ? '#e8f5e9' : '#ffebee',
                        border: `2px solid ${geminiSentiment.isPositivePublicity ? '#4caf50' : '#f44336'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <strong style={{ fontSize: '15px', color: '#333' }}>
                            Positive Publicity Assessment:
                          </strong>
                          <span style={{
                            padding: '6px 16px',
                            borderRadius: '16px',
                            fontSize: '13px',
                            fontWeight: '600',
                            backgroundColor: geminiSentiment.isPositivePublicity ? '#4caf50' : '#f44336',
                            color: 'white'
                          }}>
                            {geminiSentiment.isPositivePublicity ? '✅ YES' : '❌ NO'}
                          </span>
                        </div>
                        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#333', lineHeight: '1.6' }}>
                          {geminiSentiment.overallReasoning}
                        </p>
                      </div>

                      {/* Caption and Transcript Sentiment */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        {/* Caption Sentiment */}
                        <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <strong style={{ fontSize: '14px' }}>Caption Sentiment:</strong>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              backgroundColor: geminiSentiment.caption.sentiment === 'positive' ? '#4caf50' :
                                              geminiSentiment.caption.sentiment === 'negative' ? '#f44336' : '#9e9e9e',
                              color: 'white'
                            }}>
                              {geminiSentiment.caption.sentiment}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                            Confidence: <strong>{(geminiSentiment.caption.confidence * 100).toFixed(1)}%</strong>
                            {geminiSentiment.caption.language && geminiSentiment.caption.language !== 'unknown' && (
                              <span style={{ marginLeft: '12px' }}>
                                Language: <strong style={{ textTransform: 'uppercase' }}>{geminiSentiment.caption.language}</strong>
                                {geminiSentiment.caption.languageConfidence !== undefined && (
                                  <span style={{ fontSize: '11px', color: '#999' }}>
                                    {' '}({(geminiSentiment.caption.languageConfidence * 100).toFixed(0)}%)
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '13px', color: '#333', lineHeight: '1.5', margin: 0 }}>
                            {geminiSentiment.caption.reasoning}
                          </p>
                        </div>

                        {/* Transcript Sentiment */}
                        <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <strong style={{ fontSize: '14px' }}>Transcript Sentiment:</strong>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              backgroundColor: geminiSentiment.transcript.sentiment === 'positive' ? '#4caf50' :
                                              geminiSentiment.transcript.sentiment === 'negative' ? '#f44336' : '#9e9e9e',
                              color: 'white'
                            }}>
                              {geminiSentiment.transcript.sentiment}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                            Confidence: <strong>{(geminiSentiment.transcript.confidence * 100).toFixed(1)}%</strong>
                            {geminiSentiment.transcript.language && geminiSentiment.transcript.language !== 'unknown' && (
                              <span style={{ marginLeft: '12px' }}>
                                Language: <strong style={{ textTransform: 'uppercase' }}>{geminiSentiment.transcript.language}</strong>
                                {geminiSentiment.transcript.languageConfidence !== undefined && (
                                  <span style={{ fontSize: '11px', color: '#999' }}>
                                    {' '}({(geminiSentiment.transcript.languageConfidence * 100).toFixed(0)}%)
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '13px', color: '#333', lineHeight: '1.5', margin: 0 }}>
                            {geminiSentiment.transcript.reasoning}
                          </p>
                        </div>
                      </div>

                      <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                        Processing time: {geminiSentiment.processingTimeMs}ms
                      </div>
                    </div>
                  )}

                  {profileData.metadata.hashtags && profileData.metadata.hashtags.length > 0 && (
                    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                      <strong>Hashtags:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '5px' }}>
                        {profileData.metadata.hashtags.map((tag, idx) => (
                          <span key={idx} style={{ padding: '4px 8px', background: '#e3f2fd', borderRadius: '4px', fontSize: '12px', color: '#1976d2' }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {profileData.metadata.mentions && profileData.metadata.mentions.length > 0 && (
                    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                      <strong>Mentions:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '5px' }}>
                        {profileData.metadata.mentions.map((mention, idx) => (
                          <span key={idx} style={{ padding: '4px 8px', background: '#fff3e0', borderRadius: '4px', fontSize: '12px', color: '#e65100' }}>
                            @{mention}
                          </span>
                        ))}
                      </div>
                </div>
              )}

                  {profileData.metadata.taggedUsers && profileData.metadata.taggedUsers.length > 0 && (
                    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                      <strong>Tagged Users:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '5px' }}>
                        {profileData.metadata.taggedUsers.map((user, idx) => (
                          <span key={idx} style={{ padding: '4px 8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px', color: '#2e7d32' }}>
                            @{user}
                          </span>
                        ))}
                      </div>
                </div>
              )}

                  {profileData.metadata.musicInfo && (
                    <div style={{ marginTop: '10px', marginBottom: '10px', padding: '10px', background: '#f3e5f5', borderRadius: '4px' }}>
                      <strong>Music:</strong>
                      {profileData.metadata.musicInfo.artist && (
                        <p style={{ marginTop: '5px', fontSize: '14px' }}>
                          <strong>Artist:</strong> {profileData.metadata.musicInfo.artist}
                        </p>
                      )}
                      {profileData.metadata.musicInfo.song && (
                        <p style={{ fontSize: '14px' }}>
                          <strong>Song:</strong> {profileData.metadata.musicInfo.song}
                        </p>
                      )}
                      {profileData.metadata.musicInfo.originalAudio && (
                        <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Original Audio</p>
                      )}
                  </div>
                  )}

                  {profileData.metadata.comments && profileData.metadata.comments.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <strong>Comments ({profileData.metadata.comments.length}):</strong>
                      <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '10px' }}>
                        {profileData.metadata.comments.map((comment, idx) => (
                          <div key={comment.id || idx} style={{ padding: '12px', marginBottom: '10px', background: '#fafafa', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                              {comment.ownerProfilePicUrl && (
                                <img 
                                  src={comment.ownerProfilePicUrl} 
                                  alt={comment.author}
                                  style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '1px solid #ddd'
                                  }} 
                                />
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <strong style={{ fontSize: '13px' }}>@{comment.ownerUsername || comment.author}</strong>
                                    {comment.owner?.isVerified && (
                                      <span style={{ fontSize: '12px' }}>✓</span>
                                    )}
                                    {comment.owner?.isPrivate && (
                                      <span style={{ fontSize: '10px', color: '#666' }}>🔒</span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {(comment.likes !== undefined || comment.likesCount !== undefined) && (
                                      <span style={{ fontSize: '12px', color: '#666' }}>❤️ {(comment.likesCount !== undefined ? comment.likesCount : comment.likes)?.toLocaleString()}</span>
                                    )}
                                    {comment.repliesCount !== undefined && comment.repliesCount > 0 && (
                                      <span style={{ fontSize: '12px', color: '#666' }}>💬 {comment.repliesCount}</span>
                                    )}
                                  </div>
                                </div>
                                {comment.owner?.fullName && (
                                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                                    {comment.owner.fullName}
                                  </div>
                                )}
                                <p style={{ fontSize: '13px', color: '#333', margin: '4px 0', whiteSpace: 'pre-wrap' }}>{comment.text}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', fontSize: '11px', color: '#999' }}>
                                  <span>{new Date(comment.timestamp).toLocaleString()}</span>
                                  {comment.commentUrl && (
                                    <a href={comment.commentUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3', textDecoration: 'none' }}>
                                      View Comment →
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                            {comment.replies && comment.replies.length > 0 && (
                              <div style={{ marginLeft: '42px', marginTop: '10px', paddingLeft: '12px', borderLeft: '2px solid #e0e0e0' }}>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
                                  Replies ({comment.replies.length}):
                                </div>
                                {comment.replies.map((reply, ridx) => (
                                  <div key={reply.id || ridx} style={{ marginBottom: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                      {reply.ownerProfilePicUrl && (
                                        <img 
                                          src={reply.ownerProfilePicUrl} 
                                          alt={reply.author}
                                          style={{ 
                                            width: '24px', 
                                            height: '24px', 
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            border: '1px solid #ddd'
                                          }} 
                                        />
                                      )}
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                          <strong style={{ fontSize: '12px' }}>@{reply.ownerUsername || reply.author}</strong>
                                          {(reply.likes !== undefined || reply.likesCount !== undefined) && (
                                            <span style={{ fontSize: '11px', color: '#666' }}>❤️ {(reply.likesCount !== undefined ? reply.likesCount : reply.likes)?.toLocaleString()}</span>
                                          )}
                                        </div>
                                        <p style={{ fontSize: '12px', color: '#333', margin: '2px 0', whiteSpace: 'pre-wrap' }}>{reply.text}</p>
                                        <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                                          {new Date(reply.timestamp).toLocaleString()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {profileData.metadata.videoUrl && (
                    <div style={{ marginTop: '15px' }}>
                      <strong>Video URL:</strong>
                      <div style={{ marginTop: '5px' }}>
                        <a href={profileData.metadata.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3', fontSize: '14px', wordBreak: 'break-all' }}>
                          {profileData.metadata.videoUrl}
                        </a>
                      </div>
                    </div>
                  )}

                  {profileData.metadata.thumbnailUrl && (
                    <div style={{ marginTop: '15px' }}>
                      <strong>Thumbnail:</strong>
                      <img 
                        src={profileData.metadata.thumbnailUrl} 
                        alt="Reel thumbnail" 
                        style={{ 
                          maxWidth: '300px', 
                          maxHeight: '300px', 
                          borderRadius: '4px',
                          marginTop: '10px',
                          border: '1px solid #ddd'
                        }} 
                      />
                    </div>
                  )}

                  {profileData.metadata.childPosts && profileData.metadata.childPosts.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <strong>Child Posts ({profileData.metadata.childPosts.length}):</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '10px' }}>
                        {profileData.metadata.childPosts.map((childPost, idx) => (
                          <div key={idx} style={{ padding: '10px', background: '#fafafa', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                            {childPost.imageUrl && (
                              <img 
                                src={childPost.imageUrl} 
                                alt={childPost.caption || `Child post ${idx + 1}`}
                                style={{ 
                                  width: '100%', 
                                  maxHeight: '150px', 
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  marginBottom: '8px'
                                }} 
                              />
                            )}
                            {childPost.caption && (
                              <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', maxHeight: '60px', overflow: 'hidden' }}>
                                {childPost.caption.substring(0, 100)}{childPost.caption.length > 100 ? '...' : ''}
                              </div>
                            )}
                            {childPost.url && (
                              <a href={childPost.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0070f3', display: 'block' }}>
                                View Post →
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {profileData.metadata.imageUrls && profileData.metadata.imageUrls.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <strong>Images ({profileData.metadata.imageUrls.length}):</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '10px' }}>
                        {profileData.metadata.imageUrls.map((imageUrl, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img 
                              src={imageUrl} 
                              alt={profileData.metadata?.imageAltText?.[idx] || `Image ${idx + 1}`}
                              style={{ 
                                width: '100%', 
                                maxHeight: '200px', 
                                objectFit: 'cover',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                              }} 
                            />
                            {profileData.metadata.imageAltText && profileData.metadata.imageAltText[idx] && (
                              <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                                {profileData.metadata.imageAltText[idx]}
                              </div>
                            )}
                            {profileData.metadata.imageDimensions && profileData.metadata.imageDimensions[idx] && (
                              <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                                {profileData.metadata.imageDimensions[idx].width}x{profileData.metadata.imageDimensions[idx].height}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {profileData.creator && (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', gridColumn: '1 / -1' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Creator Profile</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                    <div>
                      {profileData.creator.username && (
                        <p><strong>Username:</strong> @{profileData.creator.username}</p>
                      )}
                      {profileData.creator.profileId && (
                        <p><strong>Profile ID:</strong> {profileData.creator.profileId}</p>
                      )}
                      {profileData.creator.followers !== undefined && profileData.creator.followers !== null && (
                        <p><strong>Followers:</strong> {profileData.creator.followers.toLocaleString()}</p>
                      )}
                      {profileData.creator.following !== undefined && profileData.creator.following !== null && (
                        <p><strong>Following:</strong> {profileData.creator.following.toLocaleString()}</p>
                      )}
                      {profileData.creator.mediaCount !== undefined && profileData.creator.mediaCount !== null && (
                        <p><strong>Posts:</strong> {profileData.creator.mediaCount.toLocaleString()}</p>
                      )}
                      {profileData.creator.videoCount !== undefined && profileData.creator.videoCount !== null && (
                        <p><strong>Videos:</strong> {profileData.creator.videoCount.toLocaleString()}</p>
                      )}
                      {profileData.creator.highlightReelsCount !== undefined && profileData.creator.highlightReelsCount !== null && (
                        <p><strong>Highlight Reels:</strong> {profileData.creator.highlightReelsCount}</p>
                      )}
                      {profileData.creator.igtvVideoCount !== undefined && profileData.creator.igtvVideoCount !== null && (
                        <p><strong>IGTV Videos:</strong> {profileData.creator.igtvVideoCount}</p>
                      )}
                      {profileData.creator.usernameChangeCount !== undefined && profileData.creator.usernameChangeCount !== null && (
                        <p><strong>Username Changes:</strong> {profileData.creator.usernameChangeCount}</p>
                      )}
                      {profileData.creator.isRecentlyJoined !== undefined && profileData.creator.isRecentlyJoined !== null && (
                        <p><strong>Recently Joined:</strong> {profileData.creator.isRecentlyJoined ? 'Yes' : 'No'}</p>
                      )}
                    </div>
                    <div>
                      {profileData.creator.profilePictureUrl && (
                        <div style={{ marginBottom: '10px' }}>
                          <strong>Profile Picture:</strong>
                          <img 
                            src={profileData.creator.profilePictureUrl} 
                            alt="Profile picture" 
                            style={{ 
                              width: '80px', 
                              height: '80px', 
                              borderRadius: '50%',
                              marginTop: '5px',
                              border: '1px solid #ddd',
                              objectFit: 'cover'
                            }} 
                          />
                        </div>
                      )}
                      {profileData.creator.verified !== undefined && (
                        <p><strong>Verified:</strong> {profileData.creator.verified ? '✅ Yes' : 'No'}</p>
                      )}
                      {profileData.creator.verifiedDate && (
                        <p><strong>Verified Date:</strong> {new Date(profileData.creator.verifiedDate).toLocaleDateString()}</p>
                      )}
                      {profileData.creator.accountType && (
                        <p><strong>Account Type:</strong> {profileData.creator.accountType}</p>
                      )}
                      {profileData.creator.businessCategory && (
                        <p><strong>Business Category:</strong> {profileData.creator.businessCategory}</p>
                      )}
                      {profileData.creator.location && (
                        <p><strong>Location:</strong> {profileData.creator.location}</p>
                      )}
                      {profileData.creator.joinDate && (
                        <p><strong>Join Date:</strong> {new Date(profileData.creator.joinDate).toLocaleDateString()}</p>
                      )}
                      {profileData.creator.facebookId && (
                        <p><strong>Facebook ID:</strong> {profileData.creator.facebookId}</p>
                      )}
                      {profileData.creator.website && (
                        <p><strong>Website:</strong> <a href={profileData.creator.website} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3' }}>{profileData.creator.website}</a></p>
                      )}
                    </div>
                  </div>

                  {profileData.creator.bio && (
                    <div style={{ marginTop: '10px', marginBottom: '15px' }}>
                      <strong>Bio:</strong>
                      <p style={{ marginTop: '5px', fontSize: '14px', color: '#666', whiteSpace: 'pre-wrap' }}>{profileData.creator.bio}</p>
                    </div>
                  )}

                  {profileData.creator.relatedProfiles && profileData.creator.relatedProfiles.length > 0 && (
                    <div style={{ marginTop: '15px', marginBottom: '15px' }}>
                      <strong>Related Profiles ({profileData.creator.relatedProfiles.length}):</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '5px' }}>
                        {profileData.creator.relatedProfiles.map((profile, idx) => (
                          <span key={idx} style={{ padding: '4px 8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px', color: '#2e7d32' }}>
                            @{profile}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {profileData.creator.latestPosts && profileData.creator.latestPosts.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <strong>Latest Posts ({profileData.creator.latestPosts.length}):</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '10px' }}>
                        {profileData.creator.latestPosts.map((post, idx) => (
                          <div key={idx} style={{ padding: '10px', background: '#fafafa', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                            <div style={{ fontSize: '12px', marginBottom: '5px' }}>
                              <strong>Type:</strong> {post.type}
                            </div>
                            {post.caption && (
                              <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px', maxHeight: '60px', overflow: 'hidden' }}>
                                {post.caption.substring(0, 100)}{post.caption.length > 100 ? '...' : ''}
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                              ❤️ {post.likes.toLocaleString()} | 💬 {post.comments.toLocaleString()}
                            </div>
                            {post.url && (
                              <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0070f3', marginTop: '5px', display: 'block' }}>
                                View Post →
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Niche Analysis Results */}
                  {nicheAnalysis && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#fff3e0', borderRadius: '4px', border: '2px solid #ff9800' }}>
                      <h3 style={{ marginTop: 0, fontSize: '16px', color: '#e65100' }}>
                        🎯 Creator Niche Analysis
                      </h3>
                      
                      <div style={{ marginBottom: '15px' }}>
                        <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                          Detected Niches:
                        </strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {nicheAnalysis.niches.map((niche, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '16px',
                                fontSize: '13px',
                                fontWeight: '600',
                                backgroundColor: '#ff9800',
                                color: 'white',
                              }}
                            >
                              {niche}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                          Confidence: <strong style={{ color: '#333' }}>{(nicheAnalysis.confidence * 100).toFixed(1)}%</strong>
                        </div>
                        <div style={{ fontSize: '13px', color: '#333', lineHeight: '1.6' }}>
                          <strong>Reasoning:</strong> {nicheAnalysis.reasoning}
                        </div>
                      </div>

                      <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                        Processing time: {nicheAnalysis.processingTimeMs}ms
                      </div>
                    </div>
                  )}

                  {/* Engagement Verification Results */}
                  {engagementVerification && (
                    <div style={{ marginTop: '20px', padding: '15px', background: engagementVerification.overallAuthentic ? '#e8f5e9' : '#ffebee', borderRadius: '4px', border: `2px solid ${engagementVerification.overallAuthentic ? '#4caf50' : '#f44336'}` }}>
                      <h3 style={{ marginTop: 0, fontSize: '16px', color: engagementVerification.overallAuthentic ? '#2e7d32' : '#c62828' }}>
                        🔍 Engagement Authenticity Verification
                      </h3>
                      
                      {/* Overall Assessment */}
                      <div style={{ 
                        marginBottom: '20px', 
                        padding: '15px', 
                        borderRadius: '4px',
                        backgroundColor: engagementVerification.overallAuthentic ? '#c8e6c9' : '#ffcdd2',
                        border: `2px solid ${engagementVerification.overallAuthentic ? '#4caf50' : '#f44336'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <strong style={{ fontSize: '15px', color: '#333' }}>
                            Overall Assessment:
                          </strong>
                          <span style={{
                            padding: '6px 16px',
                            borderRadius: '16px',
                            fontSize: '13px',
                            fontWeight: '600',
                            backgroundColor: engagementVerification.overallAuthentic ? '#4caf50' : '#f44336',
                            color: 'white'
                          }}>
                            {engagementVerification.overallAuthentic ? '✅ AUTHENTIC' : '❌ SUSPICIOUS'}
                          </span>
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#fff',
                            color: '#333'
                          }}>
                            Score: {(engagementVerification.overallScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        {engagementVerification.promotionTimestamp && (
                          <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                            <strong>Promotion Timestamp:</strong> {new Date(engagementVerification.promotionTimestamp).toLocaleString()}
                          </div>
                        )}
                        {engagementVerification.overallIssues.length > 0 && (
                          <div style={{ marginTop: '10px' }}>
                            <strong style={{ fontSize: '13px' }}>Issues Detected:</strong>
                            <ul style={{ margin: '5px 0 0 20px', fontSize: '13px', color: '#333' }}>
                              {engagementVerification.overallIssues.map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Comment Analysis */}
                      {engagementVerification.commentAnalysis && (
                        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                          <h4 style={{ marginTop: 0, fontSize: '15px', color: '#333' }}>Comment Analysis</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '15px' }}>
                            <div>
                              <div style={{ fontSize: '12px', color: '#666' }}>Total Comments</div>
                              <div style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>{engagementVerification.commentAnalysis.totalComments}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#666' }}>Suspicious</div>
                              <div style={{ fontSize: '18px', fontWeight: '600', color: engagementVerification.commentAnalysis.suspiciousComments > 0 ? '#f44336' : '#4caf50' }}>
                                {engagementVerification.commentAnalysis.suspiciousComments}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#666' }}>Bot Likelihood</div>
                              <div style={{ fontSize: '18px', fontWeight: '600', color: engagementVerification.commentAnalysis.botLikelihood > 0.4 ? '#f44336' : '#4caf50' }}>
                                {(engagementVerification.commentAnalysis.botLikelihood * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          {/* Comment Issues */}
                          {engagementVerification.commentAnalysis.issues.duplicateComments.count > 0 && (
                            <div style={{ marginBottom: '10px', padding: '10px', background: '#fff3e0', borderRadius: '4px' }}>
                              <strong style={{ fontSize: '13px' }}>Duplicate Comments:</strong> {engagementVerification.commentAnalysis.issues.duplicateComments.count} found
                              {engagementVerification.commentAnalysis.issues.duplicateComments.examples.length > 0 && (
                                <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                                  Examples: {engagementVerification.commentAnalysis.issues.duplicateComments.examples.slice(0, 3).map(ex => `"${ex.text.substring(0, 30)}..." (${ex.count}x)`).join(', ')}
                                </div>
                              )}
                            </div>
                          )}

                          {engagementVerification.commentAnalysis.issues.emojiOnlyComments.count > 0 && (
                            <div style={{ marginBottom: '10px', padding: '10px', background: '#fff3e0', borderRadius: '4px' }}>
                              <strong style={{ fontSize: '13px' }}>Emoji-Only Comments:</strong> {engagementVerification.commentAnalysis.issues.emojiOnlyComments.count} found
                            </div>
                          )}

                          {engagementVerification.commentAnalysis.issues.suspiciousTiming.detected && (
                            <div style={{ marginBottom: '10px', padding: '10px', background: '#ffebee', borderRadius: '4px' }}>
                              <strong style={{ fontSize: '13px' }}>Suspicious Timing:</strong> {engagementVerification.commentAnalysis.issues.suspiciousTiming.description}
                            </div>
                          )}

                          {engagementVerification.commentAnalysis.recommendations.length > 0 && (
                            <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                              <strong>Recommendations:</strong>
                              <ul style={{ margin: '5px 0 0 20px' }}>
                                {engagementVerification.commentAnalysis.recommendations.map((rec, idx) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Engagement Analysis */}
                      {engagementVerification.engagementAnalysis && (
                        <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                          <h4 style={{ marginTop: 0, fontSize: '15px', color: '#333' }}>Engagement Pattern Analysis</h4>
                          
                          {/* Metrics */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '15px' }}>
                            {engagementVerification.engagementAnalysis.metrics.totalLikes !== undefined && (
                              <div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Likes</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>{engagementVerification.engagementAnalysis.metrics.totalLikes.toLocaleString()}</div>
                              </div>
                            )}
                            {engagementVerification.engagementAnalysis.metrics.totalViews !== null && (
                              <div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Views</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>{engagementVerification.engagementAnalysis.metrics.totalViews.toLocaleString()}</div>
                              </div>
                            )}
                            {engagementVerification.engagementAnalysis.metrics.totalComments !== undefined && (
                              <div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Comments</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>{engagementVerification.engagementAnalysis.metrics.totalComments}</div>
                              </div>
                            )}
                            {engagementVerification.engagementAnalysis.metrics.engagementRate !== null && (
                              <div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Engagement Rate</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>{engagementVerification.engagementAnalysis.metrics.engagementRate.toFixed(2)}%</div>
                              </div>
                            )}
                            {engagementVerification.engagementAnalysis.metrics.likeToViewRatio !== null && (
                              <div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Like/View Ratio</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>{(engagementVerification.engagementAnalysis.metrics.likeToViewRatio * 100).toFixed(2)}%</div>
                              </div>
                            )}
                          </div>

                          {/* Engagement Issues */}
                          {engagementVerification.engagementAnalysis.issues.suspiciousLikePattern.detected && (
                            <div style={{ marginBottom: '10px', padding: '10px', background: '#ffebee', borderRadius: '4px' }}>
                              <strong style={{ fontSize: '13px' }}>Suspicious Like Pattern:</strong> {engagementVerification.engagementAnalysis.issues.suspiciousLikePattern.description}
                            </div>
                          )}

                          {engagementVerification.engagementAnalysis.issues.engagementRateAnomaly.detected && (
                            <div style={{ marginBottom: '10px', padding: '10px', background: '#ffebee', borderRadius: '4px' }}>
                              <strong style={{ fontSize: '13px' }}>Engagement Rate Anomaly:</strong> {engagementVerification.engagementAnalysis.issues.engagementRateAnomaly.description}
                            </div>
                          )}

                          {engagementVerification.engagementAnalysis.issues.viewLikeRatioAnomaly.detected && (
                            <div style={{ marginBottom: '10px', padding: '10px', background: '#ffebee', borderRadius: '4px' }}>
                              <strong style={{ fontSize: '13px' }}>View/Like Ratio Anomaly:</strong> {engagementVerification.engagementAnalysis.issues.viewLikeRatioAnomaly.description}
                            </div>
                          )}

                          {engagementVerification.engagementAnalysis.issues.rapidEngagementGrowth.detected && (
                            <div style={{ marginBottom: '10px', padding: '10px', background: '#ffebee', borderRadius: '4px' }}>
                              <strong style={{ fontSize: '13px' }}>Rapid Growth:</strong> {engagementVerification.engagementAnalysis.issues.rapidEngagementGrowth.description}
                            </div>
                          )}

                          {engagementVerification.engagementAnalysis.recommendations.length > 0 && (
                            <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                              <strong>Recommendations:</strong>
                              <ul style={{ margin: '5px 0 0 20px' }}>
                                {engagementVerification.engagementAnalysis.recommendations.map((rec, idx) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
                </div>
              )}

        {/* Transcription Results */}
        {transcriptionData && activeTab === 'transcription' && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>Transcription & Sentiment Results</h2>
            </div>

            {transcriptionData.transcription && (
              <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Transcription (Local Whisper)</h3>
                <p><strong>Language:</strong> {transcriptionData.transcription.language}</p>
                <p><strong>Processing Time:</strong> {(transcriptionData.transcription.processingTime / 1000).toFixed(1)}s</p>
                <div style={{ background: '#fafafa', padding: '10px', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', fontSize: '14px', color: '#111', whiteSpace: 'pre-wrap', marginTop: '10px' }}>
                  {transcriptionData.transcription.transcript || <em>No transcript available</em>}
                  </div>
                </div>
              )}

            {transcriptionData.sentiment && (
              <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>Sentiment Analysis</h3>
                  
                  <div style={{ 
                    marginBottom: '15px', 
                    padding: '10px', 
                    borderRadius: '4px',
                  backgroundColor: transcriptionData.sentiment.combined.sentiment === 'positive' ? '#e8f5e9' :
                                  transcriptionData.sentiment.combined.sentiment === 'negative' ? '#ffebee' : '#f5f5f5'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '14px' }}>Overall Sentiment:</strong>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      backgroundColor: transcriptionData.sentiment.combined.sentiment === 'positive' ? '#4caf50' :
                                      transcriptionData.sentiment.combined.sentiment === 'negative' ? '#f44336' : '#9e9e9e',
                        color: 'white'
                      }}>
                      {transcriptionData.sentiment.combined.sentiment}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                    <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                      <strong style={{ fontSize: '13px' }}>Transcript Sentiment:</strong>
                      <div style={{ marginTop: '5px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '600',
                        backgroundColor: transcriptionData.sentiment.transcript.sentiment === 'positive' ? '#c8e6c9' :
                                        transcriptionData.sentiment.transcript.sentiment === 'negative' ? '#ffcdd2' : '#e0e0e0',
                        color: transcriptionData.sentiment.transcript.sentiment === 'positive' ? '#2e7d32' :
                               transcriptionData.sentiment.transcript.sentiment === 'negative' ? '#c62828' : '#616161'
                      }}>
                        {transcriptionData.sentiment.transcript.sentiment}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                      <strong style={{ fontSize: '13px' }}>Caption Sentiment:</strong>
                      <div style={{ marginTop: '5px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '600',
                        backgroundColor: transcriptionData.sentiment.caption.sentiment === 'positive' ? '#c8e6c9' :
                                        transcriptionData.sentiment.caption.sentiment === 'negative' ? '#ffcdd2' : '#e0e0e0',
                        color: transcriptionData.sentiment.caption.sentiment === 'positive' ? '#2e7d32' :
                               transcriptionData.sentiment.caption.sentiment === 'negative' ? '#c62828' : '#616161'
                      }}>
                        {transcriptionData.sentiment.caption.sentiment}
                        </span>
                      </div>
                    </div>
                  </div>
              </div>
            )}
          </div>
        )}

        {/* Analysis Results */}
        {analysisData && activeTab === 'analysis' && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>Video Analysis Results</h2>
              <button
                onClick={resetWorkflow}
                style={{
                  padding: '8px 16px',
                  background: '#9e9e9e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                Reset All
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                <h3 style={{ marginTop: 0, fontSize: '16px' }}>Video Information</h3>
                <p><strong>Duration:</strong> {analysisData.video.duration.toFixed(1)}s</p>
                <p><strong>Frames Extracted:</strong> {analysisData.video.frameCount}</p>
                </div>
            </div>

            {analysisData.vision && (
              <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px' }}>
                  Vision Analysis (YOLO + OCR{analysisData.vision.visualSummary.visualSimilaritySummary ? ' + CLIP' : ''})
                  </h3>
                  
                {analysisData.vision.visualSummary.targetBrandConfirmation && (
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '15px', 
                      borderRadius: '4px',
                    backgroundColor: analysisData.vision.visualSummary.targetBrandConfirmation.detected ? '#e8f5e9' : '#ffebee',
                    border: `2px solid ${analysisData.vision.visualSummary.targetBrandConfirmation.detected ? '#4caf50' : '#f44336'}`
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
                        backgroundColor: analysisData.vision.visualSummary.targetBrandConfirmation.detected ? '#4caf50' : '#f44336',
                          color: 'white'
                        }}>
                        {analysisData.vision.visualSummary.targetBrandConfirmation.detected ? '✓ DETECTED' : '✗ NOT DETECTED'}
                        </span>
                      </div>
                    <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#333', fontWeight: '500' }}>
                      {analysisData.vision.visualSummary.targetBrandConfirmation.message}
                    </p>
                    </div>
                  )}

                {analysisData.vision.visualSummary.uniqueObjects.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                      Objects Detected ({analysisData.vision.visualSummary.uniqueObjects.length}):
                      </strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {analysisData.vision.visualSummary.uniqueObjects.map((obj, idx) => (
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

                {analysisData.vision.visualSummary.brandsDetected.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                      Brands/Logos Detected ({analysisData.vision.visualSummary.brandsDetected.length}):
                      </strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {analysisData.vision.visualSummary.brandsDetected.map((brand, idx) => (
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
                    </div>
                  )}

            {/* Frames */}
            {analysisData.video.frames.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '16px' }}>Extracted Frames ({analysisData.video.frames.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginTop: '10px' }}>
                  {analysisData.video.frames.map((frame, idx) => (
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
