'use client';

import { useState, useEffect } from 'react';

interface DataAnalysisTabProps {
  scrapingData?: any;
  persistedData?: any;
  onDataUpdate: (data: any) => void;
}

export default function DataAnalysisTab({ scrapingData, persistedData, onDataUpdate }: DataAnalysisTabProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(persistedData || {});
  const [error, setError] = useState<string | null>(null);

  // Sync with persisted data when it changes
  useEffect(() => {
    if (persistedData && Object.keys(persistedData).length > 0) {
      setResults(prev => {
        return { ...prev, ...persistedData };
      });
    }
  }, [persistedData]);

  const runAnalysis = async (type: 'sentiment' | 'niche' | 'region') => {
    if (!scrapingData) {
      setError('Please scrape data first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response;
      const metadata = scrapingData.data?.metadata || scrapingData.metadata;
      const reelUrl = scrapingData.data?.metadata?.reelUrl || scrapingData.reelUrl || scrapingData.data?.reelUrl || '';

      switch (type) {
        case 'sentiment':
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
          break;

        case 'niche':
          response = await fetch('/api/creators/niche-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reelUrl,
              bio: metadata?.bio || scrapingData.data?.creator?.bio || '',
              posts: metadata?.comments?.slice(0, 10) || [],
              creatorUsername: scrapingData.data?.creator?.username || null,
            }),
          });
          break;

        case 'region':
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
          break;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Analysis failed');
      }

      const updatedResults = { ...results, [type]: data };
      setResults(updatedResults);
      onDataUpdate(updatedResults);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const sentimentData = results.sentiment?.data || results.sentiment;
  const nicheData = results.niche?.data || results.niche;
  const regionData = results.region?.data || results.region;

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

      {/* Analysis Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => runAnalysis('sentiment')}
          disabled={loading || !scrapingData}
          className="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          Run Sentiment Analysis
        </button>

        <button
          onClick={() => runAnalysis('niche')}
          disabled={loading || !scrapingData}
          className="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          Run Niche Analysis
        </button>

        <button
          onClick={() => runAnalysis('region')}
          disabled={loading || !scrapingData}
          className="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          Run Region Analysis
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Sentiment Analysis */}
        {sentimentData && (
          <div className="bg-white rounded-lg shadow-lg border-2 border-purple-500 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-purple-700">Gemini Sentiment Analysis</h2>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(results.sentiment, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `sentiment-analysis-${Date.now()}.json`;
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

            {/* Positive Publicity Assessment */}
            {(sentimentData.isPositivePublicity !== undefined || sentimentData.positivePublicityAssessment !== undefined) && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-semibold text-green-900">Positive Publicity Assessment:</span>
                  <span className="bg-green-600 text-white px-3 py-1 rounded-full font-bold">
                    {(sentimentData.isPositivePublicity !== undefined ? sentimentData.isPositivePublicity : sentimentData.positivePublicityAssessment) ? 'YES' : 'NO'}
                  </span>
                </div>
                {(sentimentData.overallReasoning || sentimentData.assessmentReasoning) && (
                  <p className="text-sm text-gray-700 mt-2">{sentimentData.overallReasoning || sentimentData.assessmentReasoning}</p>
                )}
              </div>
            )}

            {/* Caption and Transcript Sentiment - Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Caption Sentiment */}
              {sentimentData.caption && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900">Caption Sentiment:</h3>
                    {sentimentData.caption.sentiment && (
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        (typeof sentimentData.caption.sentiment === 'string' ? sentimentData.caption.sentiment : sentimentData.caption.sentiment?.label || '').toUpperCase() === 'POSITIVE' ? 'bg-green-500 text-white' :
                        (typeof sentimentData.caption.sentiment === 'string' ? sentimentData.caption.sentiment : sentimentData.caption.sentiment?.label || '').toUpperCase() === 'NEGATIVE' ? 'bg-red-500 text-white' :
                        'bg-yellow-500 text-white'
                      }`}>
                        {(typeof sentimentData.caption.sentiment === 'string' ? sentimentData.caption.sentiment : sentimentData.caption.sentiment?.label || 'neutral').toUpperCase()}
                      </span>
                    )}
                  </div>
                  {sentimentData.caption.confidence !== undefined && (
                    <div className="text-xs text-gray-600 mb-2">
                      Confidence: {((sentimentData.caption.confidence || 0) * 100).toFixed(1)}%
                      {sentimentData.caption.language && ` Language: ${sentimentData.caption.language} (${sentimentData.caption.languageConfidence ? (sentimentData.caption.languageConfidence * 100).toFixed(0) : '100'}%)`}
                    </div>
                  )}
                  {sentimentData.caption.reasoning && (
                    <p className="text-sm text-gray-700">{sentimentData.caption.reasoning}</p>
                  )}
                </div>
              )}

              {/* Transcript Sentiment */}
              {sentimentData.transcript && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900">Transcript Sentiment:</h3>
                    {sentimentData.transcript.sentiment && (
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        (typeof sentimentData.transcript.sentiment === 'string' ? sentimentData.transcript.sentiment : sentimentData.transcript.sentiment?.label || '').toUpperCase() === 'POSITIVE' ? 'bg-green-500 text-white' :
                        (typeof sentimentData.transcript.sentiment === 'string' ? sentimentData.transcript.sentiment : sentimentData.transcript.sentiment?.label || '').toUpperCase() === 'NEGATIVE' ? 'bg-red-500 text-white' :
                        'bg-yellow-500 text-white'
                      }`}>
                        {(typeof sentimentData.transcript.sentiment === 'string' ? sentimentData.transcript.sentiment : sentimentData.transcript.sentiment?.label || 'neutral').toUpperCase()}
                      </span>
                    )}
                  </div>
                  {sentimentData.transcript.confidence !== undefined && (
                    <div className="text-xs text-gray-600 mb-2">
                      Confidence: {((sentimentData.transcript.confidence || 0) * 100).toFixed(1)}%
                      {sentimentData.transcript.language && ` Language: ${sentimentData.transcript.language} (${sentimentData.transcript.languageConfidence ? (sentimentData.transcript.languageConfidence * 100).toFixed(0) : '100'}%)`}
                    </div>
                  )}
                  {sentimentData.transcript.reasoning && (
                    <p className="text-sm text-gray-700">{sentimentData.transcript.reasoning}</p>
                  )}
                </div>
              )}
            </div>

            {results.sentiment?.processingTimeMs && (
              <div className="text-xs text-gray-500 mt-2">
                Processing time: {results.sentiment.processingTimeMs}ms
              </div>
            )}
          </div>
        )}

        {/* Niche Analysis */}
        {nicheData && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-yellow-900">Creator Niche Analysis</h2>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(results.niche, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `niche-analysis-${Date.now()}.json`;
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

            {/* Detected Niches */}
            {(nicheData.niches || nicheData.detectedNiches) && (nicheData.niches || nicheData.detectedNiches || []).length > 0 && (
              <div className="mb-4">
                <span className="font-semibold text-gray-900 block mb-2">Detected Niches:</span>
                <div className="flex flex-wrap gap-2">
                  {(nicheData.niches || nicheData.detectedNiches || []).map((niche: string, idx: number) => (
                    <span
                      key={idx}
                      className="bg-orange-300 text-orange-900 px-4 py-2 rounded-full font-medium"
                    >
                      {niche}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence */}
            {nicheData.confidence !== undefined && (
              <div className="mb-4">
                <span className="font-semibold text-gray-900">Confidence: </span>
                <span className="text-lg font-bold">{((nicheData.confidence || 0) * 100).toFixed(1)}%</span>
              </div>
            )}

            {/* Reasoning */}
            {nicheData.reasoning && (
              <div className="mb-4">
                <span className="font-semibold text-gray-900 block mb-2">Reasoning:</span>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{nicheData.reasoning}</p>
              </div>
            )}

            {results.niche?.processingTimeMs && (
              <div className="text-xs text-gray-500 mt-2">
                Processing time: {results.niche.processingTimeMs}ms
              </div>
            )}
          </div>
        )}

        {/* Region Analysis */}
        {regionData && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Region Analysis</h2>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(results.region, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `region-analysis-${Date.now()}.json`;
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

            {/* Language/Comment Statistics */}
            {regionData.comments && regionData.comments.languageDistribution && (
              <div className="mb-4">
                <span className="font-semibold text-gray-900 block mb-2">Examples:</span>
                {Object.entries(regionData.comments.languageDistribution)
                  .slice(0, 3)
                  .map(([lang, langData]: [string, any]) => {
                    // Handle both object and number formats
                    const langInfo = typeof langData === 'object' && langData !== null
                      ? {
                          language: langData.language || lang,
                          languageName: langData.languageName || lang,
                          count: langData.count || 0,
                          percentage: langData.percentage || 0,
                          examples: langData.examples || []
                        }
                      : {
                          language: lang,
                          languageName: lang,
                          count: typeof langData === 'number' ? langData : 0,
                          percentage: regionData.comments.totalAnalyzed > 0
                            ? ((typeof langData === 'number' ? langData : 0) / regionData.comments.totalAnalyzed * 100)
                            : 0,
                          examples: []
                        };
                    
                    const displayPercentage = langInfo.percentage > 0 
                      ? langInfo.percentage.toFixed(1)
                      : (regionData.comments.totalAnalyzed > 0
                          ? ((langInfo.count / regionData.comments.totalAnalyzed) * 100).toFixed(1)
                          : '0.0');
                    
                    return (
                      <div key={lang} className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2">
                        <div className="font-semibold">{langInfo.languageName || langInfo.language}</div>
                        <div className="text-sm text-gray-600">
                          {langInfo.count} comments ({displayPercentage}%)
                        </div>
                        {langInfo.examples && langInfo.examples.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            Examples: {langInfo.examples.slice(0, 2).map((ex: string, idx: number) => (
                              <span key={idx}>"{ex}"{idx < langInfo.examples.slice(0, 2).length - 1 ? ', ' : ''}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Primary Region */}
            {regionData.primaryRegion && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-semibold text-green-900">Primary Region:</span>
                  <span className="bg-green-600 text-white px-4 py-2 rounded-full font-bold">
                    {regionData.primaryRegion.region}
                    {regionData.primaryRegion.countryCode && `, ${regionData.primaryRegion.countryCode}`}
                  </span>
                  {regionData.primaryRegion.confidence && (
                    <span className="text-sm text-gray-700">
                      ({((regionData.primaryRegion.confidence || 0) * 100).toFixed(0)}% confidence)
                    </span>
                  )}
                </div>
                {regionData.primaryRegion.reasoning && (
                  <p className="text-sm text-gray-700 mt-2">{regionData.primaryRegion.reasoning}</p>
                )}
              </div>
            )}

            {/* All Detected Regions */}
            {regionData.regions && regionData.regions.length > 0 && (
              <div className="mb-4">
                <span className="font-semibold text-gray-900 block mb-3">All Detected Regions:</span>
                <div className="space-y-3">
                  {regionData.regions.map((region: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">
                          {region.region}
                          {region.countryCode && ` (${region.countryCode})`}
                        </span>
                        {region.confidence && (
                          <span className="text-sm text-gray-600">
                            {((region.confidence || 0) * 100).toFixed(0)}% confidence
                          </span>
                        )}
                      </div>
                      {region.languages && Object.keys(region.languages).length > 0 && (
                        <div className="text-sm text-gray-600 mb-2">
                          Languages: {Object.entries(region.languages)
                            .map(([lang, langData]: [string, any]) => {
                              // Handle both object and number formats
                              const count = typeof langData === 'object' && langData !== null
                                ? (langData.count || 0)
                                : (typeof langData === 'number' ? langData : 0);
                              const total = regionData.comments?.totalAnalyzed || 1;
                              const percentage = ((count / total) * 100).toFixed(1);
                              const langName = typeof langData === 'object' && langData !== null
                                ? (langData.languageName || langData.language || lang)
                                : lang;
                              return `${langName} (${percentage}%)`;
                            })
                            .join(', ')}
                        </div>
                      )}
                      {region.reasoning && (
                        <p className="text-sm text-gray-700">{region.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.region?.processingTimeMs && (
              <div className="text-xs text-gray-500 mt-2">
                Processing time: {results.region.processingTimeMs}ms
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
