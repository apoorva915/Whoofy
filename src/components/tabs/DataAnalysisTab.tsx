'use client';

import { useState, useEffect } from 'react';

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type AnalysisResults = {
  sentiment?: any;
  niche?: any;
  region?: any;
};

/* ------------------------------------------------------------------ */
/* Props */
/* ------------------------------------------------------------------ */

interface DataAnalysisTabProps {
  scrapingData?: any;
  persistedData?: AnalysisResults;
  onDataUpdate: (data: AnalysisResults) => void;
  /** Optional: frame analysis result (local or Google) to use OCR/objects/labels for niche when captions are empty */
  frameAnalysisData?: {
    frameAnalyses?: Array<{ text?: string; objects?: string[]; labels?: string[] }>;
  } | null;
}

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */

export default function DataAnalysisTab({
  scrapingData,
  persistedData,
  onDataUpdate,
  frameAnalysisData,
}: DataAnalysisTabProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<AnalysisResults>(persistedData || {});
  const [error, setError] = useState<string | null>(null);

  /* ---------------- Sync persisted data ---------------- */

  useEffect(() => {
    if (persistedData && Object.keys(persistedData).length > 0) {
      setResults((prev: AnalysisResults) => ({
        ...prev,
        ...persistedData,
      }));
    }
  }, [persistedData]);

  /* ---------------- Run analysis ---------------- */

  const runAnalysis = async (type: 'sentiment' | 'niche' | 'region') => {
    if (!scrapingData) {
      setError('Please scrape data first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response: Response;

      const metadata = scrapingData.data?.metadata || scrapingData.metadata;
      const reelUrl =
        scrapingData.data?.metadata?.reelUrl ||
        scrapingData.reelUrl ||
        scrapingData.data?.reelUrl ||
        '';

      if (type === 'sentiment') {
        response = await fetch('/api/sentiment/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reelUrl,
            caption: metadata?.caption,
            transcript: metadata?.transcript,
            comments: metadata?.comments || [],
          }),
        });
      } else if (type === 'niche') {
        const creator = scrapingData.data?.creator;
        const latestPosts = (creator?.latestPosts || []).slice(0, 5).map((post: any) => ({
          caption: post.caption ?? post.text ?? null,
          type: post.type ?? post.mediaType ?? 'unknown',
          likes: post.likes ?? post.likesCount ?? post.likeCount ?? 0,
          comments: post.comments ?? post.commentsCount ?? post.commentCount ?? 0,
        }));
        const commentTexts = (metadata?.comments || [])
          .map((c: any) => (typeof c === 'string' ? c : c?.text))
          .filter(Boolean);
        const suggestedProfiles = creator?.relatedProfiles ?? [];
        let frameInsights: { ocrTexts: string[]; objects: string[]; labels: string[] } | undefined;
        if (frameAnalysisData?.frameAnalyses?.length) {
          const ocrTexts: string[] = [];
          const objects: string[] = [];
          const labels: string[] = [];
          for (const fa of frameAnalysisData.frameAnalyses) {
            if (fa.text?.trim()) ocrTexts.push(fa.text.trim());
            if (Array.isArray(fa.objects)) fa.objects.forEach((o: any) => objects.push(typeof o === 'string' ? o : o?.name ?? o?.class ?? ''));
            if (Array.isArray(fa.labels)) fa.labels.forEach((l: any) => labels.push(typeof l === 'string' ? l : l?.description ?? l?.name ?? ''));
          }
          if (ocrTexts.length || objects.length || labels.length) {
            frameInsights = { ocrTexts: [...new Set(ocrTexts)], objects: [...new Set(objects)], labels: [...new Set(labels)] };
          }
        }
        response = await fetch('/api/creators/niche-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reelUrl,
            bio: metadata?.bio || creator?.bio || creator?.biography || '',
            posts: latestPosts,
            comments: commentTexts.length ? commentTexts : undefined,
            frameInsights: frameInsights || undefined,
            suggestedProfiles: suggestedProfiles.length ? suggestedProfiles : undefined,
            creatorUsername: creator?.username ?? null,
          }),
        });
      } else {
        response = await fetch('/api/language-region/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reelUrl,
            caption: metadata?.caption,
            transcript: metadata?.transcript,
            comments: metadata?.comments || [],
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || 'Analysis failed');
      }

      const updatedResults: AnalysisResults = {
        ...results,
        [type]: data,
      };

      setResults(updatedResults);
      onDataUpdate(updatedResults);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Derived data ---------------- */

  const sentimentData = results.sentiment?.data || results.sentiment;
  const nicheData = results.niche?.data || results.niche;
  const regionData = results.region?.data || results.region;

  /* ---------------- Render helpers ---------------- */

  const renderSentimentCard = () => {
    if (!sentimentData) return null;

    const caption = sentimentData.caption || {};
    const transcript = sentimentData.transcript || {};
    const isPositive = !!sentimentData.isPositivePublicity;

    const badgeClass = isPositive
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';

    const badgeLabel = isPositive ? 'YES' : 'NO';

    const sentimentToColor = (s: string | undefined) => {
      switch (s) {
        case 'positive':
          return 'text-green-700';
        case 'negative':
          return 'text-red-700';
        default:
          return 'text-gray-700';
      }
    };

    return (
      <div className="bg-white border rounded-lg shadow-sm mb-8">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Gemini Sentiment Analysis</h2>
          <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${badgeClass}`}>
            Positive Publicity: {badgeLabel}
          </span>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-700">
            {sentimentData.overallReasoning ||
              'Overall sentiment assessment for caption and transcript.'}
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Caption */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-2">Caption Sentiment</h3>
              <p className={`font-semibold ${sentimentToColor(caption.sentiment)}`}>
                {(caption.sentiment || 'neutral').toUpperCase()}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Confidence:{' '}
                {caption.confidence != null ? `${Math.round(caption.confidence * 100)}%` : 'N/A'}{' '}
                {caption.language && ` Language: ${caption.language.toUpperCase()}`}
              </p>
              {caption.reasoning && (
                <p className="text-sm text-gray-700 mt-2">{caption.reasoning}</p>
              )}
            </div>

            {/* Transcript */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-2">Transcript Sentiment</h3>
              <p className={`font-semibold ${sentimentToColor(transcript.sentiment)}`}>
                {(transcript.sentiment || 'neutral').toUpperCase()}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Confidence:{' '}
                {transcript.confidence != null
                  ? `${Math.round(transcript.confidence * 100)}%`
                  : 'N/A'}{' '}
                {transcript.language && ` Language: ${transcript.language.toUpperCase()}`}
              </p>
              {transcript.reasoning && (
                <p className="text-sm text-gray-700 mt-2">{transcript.reasoning}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNicheCard = () => {
    if (!nicheData) return null;

    const niches: string[] = nicheData.niches || [];

    return (
      <div className="bg-white border rounded-lg shadow-sm mb-8">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Niche Analysis</h2>
          {nicheData.confidence != null && (
            <span className="px-3 py-1 text-sm font-semibold rounded-full border bg-blue-50 text-blue-800 border-blue-200">
              Confidence: {Math.round(nicheData.confidence * 100)}%
            </span>
          )}
        </div>

        <div className="px-6 py-4 space-y-4">
          {niches.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Primary Niches</h3>
              <div className="flex flex-wrap gap-2">
                {niches.map((niche: string) => (
                  <span
                    key={niche}
                    className="px-3 py-1 text-sm rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200"
                  >
                    {niche}
                  </span>
                ))}
              </div>
            </div>
          )}

          {nicheData.reasoning && (
            <p className="text-sm text-gray-700">{nicheData.reasoning}</p>
          )}
        </div>
      </div>
    );
  };

  const renderRegionCard = () => {
    if (!regionData) return null;

    const primaryRegion = regionData.primaryRegion || {};
    const regions: any[] = regionData.regions || [];
    const comments = regionData.comments || {};

    return (
      <div className="bg-white border rounded-lg shadow-sm mb-8">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Region Analysis</h2>
          {primaryRegion.region && (
            <span className="px-3 py-1 text-sm font-semibold rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
              Primary Region: {primaryRegion.region}{' '}
              {primaryRegion.confidence != null &&
                `(${Math.round(primaryRegion.confidence * 100)}% confidence)`}
            </span>
          )}
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Language examples */}
          {comments?.languageDistribution && comments.languageDistribution.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Language Examples</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {comments.languageDistribution.map((lang: any) => (
                  <li key={lang.language}>
                    <span className="font-semibold">
                      {lang.languageName || lang.language}:
                    </span>{' '}
                    {lang.examples?.slice(0, 3).join(' | ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Regions list */}
          {regions.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">All Detected Regions</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {regions.map((r) => (
                  <li key={r.region}>
                    <span className="font-semibold">{r.region}</span>
                    {r.confidence != null && ` • ${Math.round(r.confidence * 100)}% confidence`}
                    {r.reasoning && ` – ${r.reasoning}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ---------------- Render ---------------- */

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Data Analysis</h1>

      {!scrapingData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            Please scrape data first using the Data Scraping tab.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => runAnalysis('sentiment')}
          disabled={loading || !scrapingData}
          className="px-6 py-4 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
        >
          Run Sentiment Analysis
        </button>

        <button
          onClick={() => runAnalysis('niche')}
          disabled={loading || !scrapingData}
          className="px-6 py-4 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
        >
          Run Niche Analysis
        </button>

        <button
          onClick={() => runAnalysis('region')}
          disabled={loading || !scrapingData}
          className="px-6 py-4 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
        >
          Run Region Analysis
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {renderSentimentCard()}
      {renderNicheCard()}
      {renderRegionCard()}
    </div>
  );
}
