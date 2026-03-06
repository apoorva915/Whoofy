'use client';

import { useState, useEffect } from 'react';

interface FrameAnalysisLocalTabProps {
  scrapingData?: any;
  persistedData?: any;
  onDataUpdate: (data: any) => void;
}

export default function FrameAnalysisLocalTab({
  scrapingData,
  persistedData,
  onDataUpdate,
}: FrameAnalysisLocalTabProps) {
  const [reelUrl, setReelUrl] = useState(() => {
    if (scrapingData) {
      return scrapingData.data?.metadata?.reelUrl || scrapingData.reelUrl || '';
    }
    return '';
  });
  const [targetBrandName, setTargetBrandName] = useState('');
  const [productNames, setProductNames] = useState('');
  const [targetGender, setTargetGender] = useState('');
  const [targetAge, setTargetAge] = useState('');
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
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reelUrl: urlToUse,
          targetBrandName: targetBrandName || undefined,
          productNames: productNames.split(',').map(p => p.trim()).filter(p => p.length > 0),
          targetGender: targetGender?.trim() || undefined,
          targetAge: targetAge?.trim() || undefined,
          productImages: productImages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || data.error?.code || 'Frame analysis failed';
        console.error('Frame analysis API error:', {
          status: response.status,
          error: data.error,
          message: errorMessage,
        });
        throw new Error(errorMessage);
      }

      if (!data.success) {
        const errorMessage = data.error?.message || data.error?.code || 'Frame analysis failed';
        console.error('Frame analysis failed:', data);
        throw new Error(errorMessage);
      }

      // Validate response structure
      if (!data.data) {
        console.warn('Frame analysis response missing data field:', data);
        // Still set the result in case the structure is different
      }

      setResult(data);
      onDataUpdate(data);
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred during local frame analysis';
      console.error('Error in local frame analysis:', {
        error: err,
        message: errorMessage,
        stack: err.stack,
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Safely extract data with fallbacks
  const videoData = result?.data?.video || null;
  const visionData = result?.data?.vision || null;
  const visualSummary = visionData?.visualSummary || null;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Frame & Video Analysis</h1>
        {result && (
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(result, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `frame-analysis-local-${Date.now()}.json`;
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
              Target Brand Name
            </label>
            <input
              type="text"
              value={targetBrandName}
              onChange={(e) => setTargetBrandName(e.target.value)}
              placeholder="e.g., garnier, garnieruk"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Names (comma-separated)
            </label>
            <input
              type="text"
              value={productNames}
              onChange={(e) => setProductNames(e.target.value)}
              placeholder="e.g., Vitamin C, Serum, Brightening, Garnier"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Gender (Optional)
              </label>
              <select
                value={targetGender}
                onChange={(e) => setTargetGender(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Not specified —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Demographic match will compare detected people with this target</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Age Bracket (Optional)
              </label>
              <select
                value={targetAge}
                onChange={(e) => setTargetAge(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Not specified —</option>
                <option value="child">Child</option>
                <option value="young">Young</option>
                <option value="middle_age">Middle Age</option>
                <option value="old">Old</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Demographic match will compare detected people with this target</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Images (Optional - for CLIP visual similarity)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
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
          {loading ? 'Analyzing Frames...' : 'Start Video Analysis'}
        </button>
      </div>

      {/* Checks summary - shown when we have results and targets were specified */}
      {result && visualSummary?.demographicMatch && (targetGender || targetAge) && (
        <div className="bg-white border rounded-lg shadow-sm p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Checks</h3>
          <div className="flex flex-wrap gap-4">
            {targetGender && (
              <div className="flex items-center gap-2">
                <span className={
                  visualSummary.demographicMatch.detectedGender?.toLowerCase() === targetGender.toLowerCase()
                    ? 'text-green-600'
                    : 'text-red-600'
                }>
                  {visualSummary.demographicMatch.detectedGender?.toLowerCase() === targetGender.toLowerCase() ? '✓' : '✗'}
                </span>
                <span className="text-sm">Gender</span>
              </div>
            )}
            {targetAge && (
              <div className="flex items-center gap-2">
                <span className={
                  (visualSummary.demographicMatch.detectedAge?.replace(/_/g, ' ') || '').toLowerCase() ===
                  (targetAge?.replace(/_/g, ' ') || '').toLowerCase()
                    ? 'text-green-600'
                    : 'text-red-600'
                }>
                  {(visualSummary.demographicMatch.detectedAge?.replace(/_/g, ' ') || '').toLowerCase() ===
                  (targetAge?.replace(/_/g, ' ') || '').toLowerCase()
                    ? '✓'
                    : '✗'}
                </span>
                <span className="text-sm">Age</span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {result && videoData && (
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
                <span className="text-sm text-gray-600">Frames Extracted:</span>
                <div className="text-lg font-semibold">{videoData.frameCount || 0}</div>
              </div>
            </div>
          </div>

          {/* Vision Analysis (YOLO + OCR + CLIP) */}
          {visualSummary && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Vision Analysis (YOLO + OCR + CLIP)</h2>

              {/* Brand Detection Confirmation */}
              {visualSummary.targetBrandConfirmation && (
                <div className={`border-2 rounded-lg p-4 mb-4 ${
                  visualSummary.targetBrandConfirmation.detected 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-red-50 border-red-500'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900">Brand Detection Confirmation:</span>
                    <span className={`px-4 py-2 rounded-full font-bold ${
                      visualSummary.targetBrandConfirmation.detected 
                        ? 'bg-green-600 text-white' 
                        : 'bg-red-600 text-white'
                    }`}>
                      {visualSummary.targetBrandConfirmation.detected ? 'DETECTED' : 'NOT DETECTED'}
                    </span>
                  </div>
                  {visualSummary.targetBrandConfirmation.message && (
                    <p className="text-sm text-gray-700">
                      {visualSummary.targetBrandConfirmation.message}
                    </p>
                  )}
                </div>
              )}

              {/* Objects Detected */}
              {visualSummary.uniqueObjects && visualSummary.uniqueObjects.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Objects Detected ({visualSummary.uniqueObjects.length}):
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {visualSummary.uniqueObjects.map((obj: string, idx: number) => (
                      <span
                        key={idx}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                      >
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Brands/Logos Detected */}
              {visualSummary.detectedBrands && visualSummary.detectedBrands.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Brands/Logos Detected ({visualSummary.detectedBrands.length}):
                  </h3>
                  <div className="space-y-2">
                    {visualSummary.detectedBrands.map((brand: any, idx: number) => {
                      const brandName = typeof brand === 'string' ? brand : brand.name;
                      const confidence = typeof brand === 'object' && brand.confidence 
                        ? brand.confidence 
                        : (typeof brand === 'object' && brand.frameCount ? 0.5 : 0);
                      const frameCount = typeof brand === 'object' && brand.frameCount 
                        ? brand.frameCount 
                        : 1;
                      
                      return (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div>
                            <span className="font-semibold">{brandName}</span>
                            <div className="text-sm text-gray-600">
                              Visible in {frameCount} frame{frameCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                          {confidence > 0 && (
                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                              {Math.round(confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
                  const timestamp = videoData.duration ? (idx * (videoData.duration / videoData.frames.length)).toFixed(1) : idx;
                  
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
                      {(visualSummary?.frameAnalyses?.[idx]?.brands?.some((b: any) => {
                        const brandName = typeof b === 'string' ? b : b.name;
                        const targetLower = targetBrandName.toLowerCase();
                        return brandName?.toLowerCase().includes(targetLower) || targetLower.includes(brandName?.toLowerCase() || '');
                      }) || visualSummary?.frameAnalyses?.[idx]?.visualSimilarity?.match) && (
                        <span className="absolute top-1 right-1 bg-green-600 text-white text-xs px-2 py-1 rounded font-bold">
                          MATCH
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overall Demographics & Reference Match Summary */}
          {visualSummary?.frameAnalyses && visualSummary.frameAnalyses.length > 0 && (() => {
            const frameAnalyses = visualSummary.frameAnalyses;
            const peopleFrames = frameAnalyses.filter((fa: any) => fa.people && fa.people.length > 0);
            const genderCounts: Record<string, { count: number; totalConf: number }> = {};
            const ageCounts: Record<string, { count: number; totalConf: number }> = {};
            let refMatchSum = 0;
            let refMatchCount = 0;
            let refMatchMax = 0;

            peopleFrames.forEach((fa: any) => {
              const p = fa.people[0];
              const g = (p.gender || 'unknown').toLowerCase();
              const a = (p.ageBracket || 'unknown').replace(/_/g, ' ');
              if (!genderCounts[g]) genderCounts[g] = { count: 0, totalConf: 0 };
              genderCounts[g].count++;
              genderCounts[g].totalConf += p.genderConfidence || 0;
              if (!ageCounts[a]) ageCounts[a] = { count: 0, totalConf: 0 };
              ageCounts[a].count++;
              ageCounts[a].totalConf += p.ageConfidence || 0;
            });

            frameAnalyses.forEach((fa: any) => {
              const vs = fa.visualSimilarity;
              if (vs && vs.similarity !== undefined) {
                refMatchSum += vs.similarity;
                refMatchCount++;
                refMatchMax = Math.max(refMatchMax, vs.similarity);
              }
            });

            const topGender = Object.entries(genderCounts).sort((a, b) => b[1].count - a[1].count)[0];
            const topAge = Object.entries(ageCounts).sort((a, b) => b[1].count - a[1].count)[0];
            const avgRefMatch = refMatchCount > 0 ? refMatchSum / refMatchCount : 0;

            return (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Overall Summary (All Frames)</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {topGender && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <span className="text-xs text-gray-500 uppercase">Overall Gender</span>
                      <div className="text-lg font-semibold text-gray-900 capitalize mt-1">
                        {topGender[0]} — {topGender[1].count} frame{topGender[1].count !== 1 ? 's' : ''}
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg confidence: {Math.round((topGender[1].totalConf / topGender[1].count) * 100)}%
                      </div>
                    </div>
                  )}
                  {topAge && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <span className="text-xs text-gray-500 uppercase">Overall Age Bracket</span>
                      <div className="text-lg font-semibold text-gray-900 capitalize mt-1">
                        {topAge[0]} — {topAge[1].count} frame{topAge[1].count !== 1 ? 's' : ''}
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg confidence: {Math.round((topAge[1].totalConf / topAge[1].count) * 100)}%
                      </div>
                    </div>
                  )}
                  {refMatchCount > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <span className="text-xs text-gray-500 uppercase">Reference Image Match</span>
                      <div className="text-lg font-semibold text-gray-900 mt-1">
                        Avg: {Math.round(avgRefMatch * 100)}% · Max: {Math.round(refMatchMax * 100)}%
                      </div>
                    </div>
                  )}
                  {visualSummary?.demographicMatch && (
                    <div className={`md:col-span-3 rounded-lg p-4 border-2 ${
                      visualSummary.demographicMatch.matched ? 'bg-green-50 border-green-500' : 'bg-amber-50 border-amber-500'
                    }`}>
                      <span className="text-xs text-gray-500 uppercase">Target Demographic Match</span>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`px-3 py-1 rounded-full font-bold text-sm ${
                          visualSummary.demographicMatch.matched ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'
                        }`}>
                          {visualSummary.demographicMatch.matched ? 'MATCHED' : 'NOT MATCHED'}
                        </span>
                        <span className="text-sm text-gray-700">
                          Target: {visualSummary.demographicMatch.targetGender || '—'} (gender), {visualSummary.demographicMatch.targetAge?.replace(/_/g, ' ') || '—'} (age) · Detected: {visualSummary.demographicMatch.detectedGender || '—'}, {visualSummary.demographicMatch.detectedAge || '—'}
                        </span>
                      </div>
                      {visualSummary.demographicMatch.reasoning && (
                        <p className="text-sm text-gray-600 mt-1">{visualSummary.demographicMatch.reasoning}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Frame-by-Frame Analysis */}
          {visualSummary?.frameAnalyses && visualSummary.frameAnalyses.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Frame-by-Frame Analysis</h2>
              <div className="space-y-4">
                {visualSummary.frameAnalyses.map((frameAnalysis: any, idx: number) => {
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
                          <div className="font-semibold text-gray-900 mb-3">
                            Frame at {frameAnalysis.timestamp?.toFixed(1) || (idx * 2).toFixed(1)}s
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            {frameAnalysis.people && frameAnalysis.people.length > 0 && (
                              <>
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
                                      {frameAnalysis.people[0].ageBracket} {Math.round((frameAnalysis.people[0].ageConfidence || 0) * 100)}%
                                    </div>
                                  </div>
                                )}
                                {frameAnalysis.people[0].faceDetected !== undefined && (
                                  <div>
                                    <span className="text-xs text-gray-500 uppercase">FACE DETECTION</span>
                                    <div className={`text-sm font-semibold ${
                                      (frameAnalysis.people[0].faceConfidence || 0) > 0.7 ? 'text-green-600' : 'text-orange-600'
                                    }`}>
                                      {Math.round((frameAnalysis.people[0].faceConfidence || 0) * 100)}%
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {frameAnalysis.objects && frameAnalysis.objects.length > 0 && (
                            <div className="mt-2 text-xs text-gray-600">
                              Objects: {frameAnalysis.objects.map((o: any) => typeof o === 'string' ? o : o.class || o.name).join(', ')}
                            </div>
                          )}
                          {frameAnalysis.brands && frameAnalysis.brands.length > 0 && (
                            <div className="mt-1 text-xs text-blue-600">
                              Brands: {frameAnalysis.brands.map((b: any) => typeof b === 'string' ? b : b.name).join(', ')}
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
          {visualSummary?.frameAnalyses && visualSummary.frameAnalyses.some((fa: any) => fa.visualSimilarity && fa.visualSimilarity.match) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-2">Reference Image Matches</h2>
              <p className="text-sm text-gray-600 mb-4">
                Frames that visually match your uploaded reference images based on labels, objects, and logos
              </p>
              <div className="space-y-4">
                {visualSummary.frameAnalyses.map((frameAnalysis: any, idx: number) => {
                  if (!frameAnalysis.visualSimilarity || !frameAnalysis.visualSimilarity.match) return null;
                  
                  const framePath = videoData.frames?.[idx];
                  const frameUrl = framePath?.startsWith('http') 
                    ? framePath 
                    : framePath 
                      ? `/api/frames?path=${encodeURIComponent(framePath)}`
                      : null;
                  
                  const match = frameAnalysis.visualSimilarity;
                  
                  return (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
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
                            <span className="text-sm font-medium">Reference Image #{match.referenceImageIndex !== undefined ? match.referenceImageIndex + 1 : 1}</span>
                            {match.similarity !== undefined && (
                              <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                                match.similarity > 0.7 
                                  ? 'bg-green-100 text-green-800' 
                                  : match.similarity > 0.5 
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}>
                                {Math.round(match.similarity * 100)}% match ({match.confidence || (match.similarity > 0.7 ? 'high' : match.similarity > 0.5 ? 'medium' : 'low')})
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
                  );
                }).filter(Boolean)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
