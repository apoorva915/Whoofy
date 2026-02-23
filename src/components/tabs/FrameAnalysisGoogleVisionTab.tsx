'use client';

import { useState, useEffect } from 'react';

interface FrameAnalysisGoogleVisionTabProps {
  scrapingData?: any;
  persistedData?: any;
  onDataUpdate: (data: any) => void;
}

export default function FrameAnalysisGoogleVisionTab({
  scrapingData,
  persistedData,
  onDataUpdate,
}: FrameAnalysisGoogleVisionTabProps) {
  const [reelUrl, setReelUrl] = useState(() => {
    if (scrapingData) {
      return scrapingData.data?.metadata?.reelUrl || scrapingData.reelUrl || '';
    }
    return '';
  });
  const [targetBrandName, setTargetBrandName] = useState('');
  const [productNames, setProductNames] = useState('');
  const [additionalTerms, setAdditionalTerms] = useState('');
  const [frameInterval, setFrameInterval] = useState(2); // seconds between frames (1 = more frames, better for reference match)
  const [productImages, setProductImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(persistedData || null);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setProductImages((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (persistedData) {
      setResult(persistedData);
    }
    if (scrapingData) {
      const url = scrapingData.data?.metadata?.reelUrl || scrapingData.reelUrl;
      if (url && url !== reelUrl) setReelUrl(url);
    }
  }, [persistedData, scrapingData]);

  const handleAnalyze = async () => {
    const urlToUse = reelUrl || scrapingData?.data?.metadata?.reelUrl || scrapingData?.reelUrl;
    
    if (!urlToUse) {
      setError('Please provide a reel URL or scrape data first');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze/google-vision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reelUrl: urlToUse,
          targetBrandName: targetBrandName || undefined,
          productNames: productNames.split(',').map(p => p.trim()).filter(p => p.length > 0),
          additionalTerms: additionalTerms.split(',').map(t => t.trim()).filter(t => t.length > 0),
          productImages: productImages,
          frameInterval: frameInterval,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Google Vision analysis failed');
      }

      setResult(data);
      onDataUpdate(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const videoData = result?.data?.video;
  const analysisData = result?.data?.analysis;
  const summary = analysisData?.summary;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Frame Analysis using Google Vision</h1>
        {result && (
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(result, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `frame-analysis-google-vision-${Date.now()}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            📥 Download JSON
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reel URL *
            </label>
            <input
              type="text"
              value={reelUrl}
              onChange={(e) => setReelUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Brand Name (Optional)
            </label>
            <input
              type="text"
              value={targetBrandName}
              onChange={(e) => setTargetBrandName(e.target.value)}
              placeholder="e.g., Garnier"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frame interval (seconds)
            </label>
            <select
              value={frameInterval}
              onChange={(e) => setFrameInterval(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={2}>1 frame every 2s (default)</option>
              <option value={1}>1 frame per second (denser; use if reference does not match)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">If reference image does not match, analysis is auto-retried with 1 fps.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Product Names (Optional - comma-separated)
            </label>
            <input
              type="text"
              value={productNames}
              onChange={(e) => setProductNames(e.target.value)}
              placeholder="e.g., Dairy Milk, Silk Brownie, Oreo"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter product names to specifically detect in the video frames
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Detection Terms (Optional - comma-separated)
            </label>
            <input
              type="text"
              value={additionalTerms}
              onChange={(e) => setAdditionalTerms(e.target.value)}
              placeholder="e.g., chocolate, snack, beverage, logo"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter additional keywords or terms to detect (will be searched in labels, text, and objects)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Reference Images (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Upload reference images of products to help with visual matching and brand detection
            </p>
            {productImages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {productImages.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={img}
                      alt={`Product ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-semibold"
        >
          {loading ? 'Analyzing with Google Vision...' : 'Start Google Vision Analysis'}
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Uses Google Cloud Vision API for label detection, text detection (OCR), logo detection, and brand detection
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {result && videoData && analysisData && (
        <div className="space-y-6">
          {/* Video Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Video Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-600">Duration:</span>
                <div className="text-lg font-semibold">{videoData.duration?.toFixed(1) || '0.0'}s</div>
              </div>
              <div>
                <span className="text-sm text-gray-600">Frames Analyzed:</span>
                <div className="text-lg font-semibold">{videoData.frameCount || 0}</div>
              </div>
            </div>
          </div>

          {/* Combined Target Detection (legacy) */}
          {summary?.targetBrandDetection && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Overall Target Detection</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-4 py-2 rounded-full font-bold ${
                    summary.targetBrandDetection.detected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {summary.targetBrandDetection.detected ? 'DETECTED' : 'NOT DETECTED'}
                  </span>
                  {summary.targetBrandDetection.confidence !== undefined && (
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {(summary.targetBrandDetection.confidence * 100).toFixed(1)}% confidence
                    </span>
                  )}
                </div>
                {summary.targetBrandDetection.message && (
                  <p className="text-sm text-gray-700 mt-2">{summary.targetBrandDetection.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Separate: Brand Detection */}
          {summary?.brandDetection && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Brand Detection</h2>
              <div className={`rounded-lg p-4 border-2 ${summary.brandDetection.detected ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-300'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-semibold">Looked for: {summary.brandDetection.items?.join(', ') || '—'}</span>
                  <span className={`px-3 py-1 rounded-full font-bold text-sm ${summary.brandDetection.detected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {summary.brandDetection.detected ? 'DETECTED' : 'NOT DETECTED'}
                  </span>
                  {summary.brandDetection.confidence !== undefined && summary.brandDetection.detected && (
                    <span className="text-sm text-gray-700">{(summary.brandDetection.confidence * 100).toFixed(1)}%</span>
                  )}
                </div>
                {summary.brandDetection.message && <p className="text-sm text-gray-700 mt-1">{summary.brandDetection.message}</p>}
              </div>
            </div>
          )}

          {/* Separate: Product Detection */}
          {summary?.productDetection && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Product Detection</h2>
              <div className={`rounded-lg p-4 border-2 ${summary.productDetection.detected ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-300'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-semibold">Looked for: {summary.productDetection.items?.join(', ') || '—'}</span>
                  <span className={`px-3 py-1 rounded-full font-bold text-sm ${summary.productDetection.detected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {summary.productDetection.detected ? 'DETECTED' : 'NOT DETECTED'}
                  </span>
                  {summary.productDetection.confidence !== undefined && summary.productDetection.detected && (
                    <span className="text-sm text-gray-700">{(summary.productDetection.confidence * 100).toFixed(1)}%</span>
                  )}
                </div>
                {summary.productDetection.message && <p className="text-sm text-gray-700 mt-1">{summary.productDetection.message}</p>}
              </div>
            </div>
          )}

          {/* Separate: Object Detection */}
          {summary?.objectDetection && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Object Detection</h2>
              <div className={`rounded-lg p-4 border-2 ${summary.objectDetection.detected ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-300'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-semibold">Looked for: {summary.objectDetection.items?.join(', ') || '—'}</span>
                  <span className={`px-3 py-1 rounded-full font-bold text-sm ${summary.objectDetection.detected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {summary.objectDetection.detected ? 'DETECTED' : 'NOT DETECTED'}
                  </span>
                  {summary.objectDetection.confidence !== undefined && summary.objectDetection.detected && (
                    <span className="text-sm text-gray-700">{(summary.objectDetection.confidence * 100).toFixed(1)}%</span>
                  )}
                </div>
                {summary.objectDetection.message && <p className="text-sm text-gray-700 mt-1">{summary.objectDetection.message}</p>}
              </div>
            </div>
          )}

          {/* Labels Detected */}
          {summary?.labels && summary.labels.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                Labels Detected ({summary.labels.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {summary.labels.map((label: any, idx: number) => {
                  const labelName = typeof label === 'string' ? label : label.name || label.description;
                  const confidence = typeof label === 'object' && label.confidence !== undefined
                    ? label.confidence
                    : 0.5;
                  
                  return (
                    <span
                      key={idx}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {labelName} ({Math.round(confidence * 100)}%)
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logos Detected */}
          {summary?.logos && summary.logos.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                Logos Detected ({summary.logos.length})
              </h2>
              <div className="space-y-2">
                {summary.logos.map((logo: any, idx: number) => {
                  const logoName = typeof logo === 'string' ? logo : logo.name || logo.description;
                  const confidence = typeof logo === 'object' && logo.confidence !== undefined
                    ? logo.confidence
                    : 0.5;
                  const occurrences = typeof logo === 'object' && logo.occurrences !== undefined
                    ? logo.occurrences
                    : 1;
                  
                  return (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div>
                        <span className="font-semibold">{logoName}</span>
                        <div className="text-sm text-gray-600">
                          Detected in {occurrences} frame{occurrences !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        {Math.round(confidence * 100)}% confidence
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Objects Detected */}
          {summary?.objects && summary.objects.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                Objects Detected ({summary.objects.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {summary.objects.map((obj: any, idx: number) => {
                  const objName = typeof obj === 'string' ? obj : obj.name;
                  const confidence = typeof obj === 'object' && obj.confidence !== undefined
                    ? obj.confidence
                    : 0.5;
                  
                  return (
                    <span
                      key={idx}
                      className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {objName} ({Math.round(confidence * 100)}%)
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Brands Detected */}
          {summary?.brands && summary.brands.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                Brands Detected ({summary.brands.length})
              </h2>
              <div className="space-y-2">
                {summary.brands.map((brand: any, idx: number) => {
                  const brandName = typeof brand === 'string' ? brand : brand.name;
                  const confidence = typeof brand === 'object' && brand.confidence !== undefined
                    ? brand.confidence
                    : 0.5;
                  
                  return (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <span className="font-semibold">{brandName}</span>
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        {Math.round(confidence * 100)}% confidence
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Text Detected (OCR) */}
          {summary?.allText && summary.allText.trim().length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Text Detected (OCR)</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary.allText}</p>
              </div>
            </div>
          )}

          {/* Extracted Frames */}
          {videoData.frames && videoData.frames.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                Extracted Frames ({videoData.frames.length})
              </h2>
              <div className="grid grid-cols-6 gap-2 overflow-x-auto">
                {videoData.frames.map((frame: string, idx: number) => {
                  const framePath = frame.startsWith('http') ? frame : `/api/frames?path=${encodeURIComponent(frame)}`;
                  
                  return (
                    <div key={idx} className="relative">
                      <img
                        src={framePath}
                        alt={`Frame ${idx + 1}`}
                        className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-75"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-frame.png';
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Frame-by-Frame Analysis */}
          {analysisData.frameAnalyses && analysisData.frameAnalyses.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Frame-by-Frame Analysis</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {analysisData.frameAnalyses.map((frameAnalysis: any, idx: number) => {
                  const framePath = videoData.frames?.[idx];
                  const frameUrl = framePath?.startsWith('http') 
                    ? framePath 
                    : framePath 
                      ? `/api/frames?path=${encodeURIComponent(framePath)}`
                      : null;
                  
                  return (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex gap-4">
                        {frameUrl && (
                          <img
                            src={frameUrl}
                            alt={`Frame at ${frameAnalysis.timestamp?.toFixed(1) || idx}s`}
                            className="w-32 h-32 object-cover rounded border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-frame.png';
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-2">
                            Frame at {frameAnalysis.timestamp?.toFixed(1) || (idx * 2).toFixed(1)}s
                          </div>
                          {frameAnalysis.people && frameAnalysis.people.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                              {frameAnalysis.people[0].gender && (
                                <div>
                                  <span className="text-xs text-gray-500 uppercase">GENDER</span>
                                  <div className={`text-sm font-semibold ${
                                    (frameAnalysis.people[0].genderConfidence || 0) > 0.8 ? 'text-green-600' : 'text-orange-600'
                                  }`}>
                                    {frameAnalysis.people[0].gender} {Math.round((frameAnalysis.people[0].genderConfidence || 0) * 100)}%
                                  </div>
                                </div>
                              )}
                              {frameAnalysis.people[0].ageBracket && (
                                <div>
                                  <span className="text-xs text-gray-500 uppercase">AGE BRACKET</span>
                                  <div className={`text-sm font-semibold ${
                                    (frameAnalysis.people[0].ageConfidence || 0) > 0.8 ? 'text-green-600' : 'text-orange-600'
                                  }`}>
                                    {frameAnalysis.people[0].ageBracket.replace('_', ' ')} {Math.round((frameAnalysis.people[0].ageConfidence || 0) * 100)}%
                                  </div>
                                </div>
                              )}
                              {frameAnalysis.people[0].faceConfidence !== undefined && (
                                <div>
                                  <span className="text-xs text-gray-500 uppercase">FACE DETECTION</span>
                                  <div className={`text-sm font-semibold ${
                                    (frameAnalysis.people[0].faceConfidence || 0) > 0.7 ? 'text-green-600' : 'text-orange-600'
                                  }`}>
                                    {Math.round((frameAnalysis.people[0].faceConfidence || 0) * 100)}%
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {frameAnalysis.labels && frameAnalysis.labels.length > 0 && (
                            <div className="text-xs text-gray-600 mb-1">
                              <span className="font-medium">Labels:</span> {frameAnalysis.labels.slice(0, 5).map((l: any) => l.description || l.name).join(', ')}
                              {frameAnalysis.labels.length > 5 && '...'}
                            </div>
                          )}
                          {frameAnalysis.logos && frameAnalysis.logos.length > 0 && (
                            <div className="text-xs text-blue-600 mb-1">
                              <span className="font-medium">Logos:</span> {frameAnalysis.logos.map((l: any) => l.description || l.name).join(', ')}
                            </div>
                          )}
                          {frameAnalysis.brands && frameAnalysis.brands.length > 0 && (
                            <div className="text-xs text-green-600 mb-1">
                              <span className="font-medium">Brands:</span> {frameAnalysis.brands.map((b: any) => b.name).join(', ')}
                            </div>
                          )}
                          {frameAnalysis.text && frameAnalysis.text.trim().length > 0 && (
                            <div className="text-xs text-purple-600">
                              <span className="font-medium">Text:</span> {frameAnalysis.text.substring(0, 100)}
                              {frameAnalysis.text.length > 100 && '...'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reference Image Matches */}
          {analysisData.frameAnalyses && analysisData.frameAnalyses.some((fa: any) => fa.visualMatches && fa.visualMatches.length > 0) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-2">Reference Image Matches</h2>
              <p className="text-sm text-gray-600 mb-4">
                Frames that visually match your uploaded reference images based on labels, objects, and logos
              </p>
              <div className="space-y-4">
                {analysisData.frameAnalyses.map((frameAnalysis: any, idx: number) => {
                  if (!frameAnalysis.visualMatches || frameAnalysis.visualMatches.length === 0) return null;
                  
                  const framePath = videoData.frames?.[idx];
                  const frameUrl = framePath?.startsWith('http') 
                    ? framePath 
                    : framePath 
                      ? `/api/frames?path=${encodeURIComponent(framePath)}`
                      : null;
                  
                  return frameAnalysis.visualMatches.map((match: any, matchIdx: number) => (
                    <div key={`${idx}-${matchIdx}`} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex gap-4">
                        {frameUrl && (
                          <img
                            src={frameUrl}
                            alt={`Frame at ${frameAnalysis.timestamp?.toFixed(1) || 'N/A'}s`}
                            className="w-32 h-32 object-cover rounded border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-frame.png';
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-2">
                            Frame at {frameAnalysis.timestamp?.toFixed(1) || 'N/A'}s
                          </div>
                          <div className="mb-2">
                            <span className="text-sm font-medium">Reference Image #{match.referenceImageIndex + 1}</span>
                            {match.similarity !== undefined && (
                              <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                                match.similarity > 0.7 
                                  ? 'bg-green-100 text-green-800' 
                                  : match.similarity > 0.5 
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}>
                                {Math.round(match.similarity * 100)}% match ({match.similarity > 0.7 ? 'high' : match.similarity > 0.5 ? 'medium' : 'low'})
                              </span>
                            )}
                          </div>
                          {match.matchingLogos && match.matchingLogos.length > 0 && (
                            <div className="text-sm text-gray-700 mb-1">
                              <span className="font-medium">Matching Logos:</span> {match.matchingLogos.join(', ')}
                            </div>
                          )}
                          {match.matchingObjects && match.matchingObjects.length > 0 && (
                            <div className="text-sm text-gray-700">
                              <span className="font-medium">Matching Objects:</span> {match.matchingObjects.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ));
                }).filter(Boolean)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
