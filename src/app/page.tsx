'use client';

import { useState } from 'react';
import DataScrapingTab from '@/components/tabs/DataScrapingTab';
import DataAnalysisTab from '@/components/tabs/DataAnalysisTab';
import FrameAnalysisLocalTab from '@/components/tabs/FrameAnalysisLocalTab';
import FrameAnalysisGoogleVisionTab from '@/components/tabs/FrameAnalysisGoogleVisionTab';
import EngagementAnalysisTab from '@/components/tabs/EngagementAnalysisTab';

type TabType = 
  | 'data-scraping'
  | 'data-analysis'
  | 'frame-analysis-local'
  | 'frame-analysis-google'
  | 'engagement';

interface AnalysisData {
  scraping?: any;
  analysis?: any;
  frameAnalysisLocal?: any;
  frameAnalysisGoogle?: any;
  [key: string]: any;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('data-scraping');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [analysisData, setAnalysisData] = useState<AnalysisData>({});

  const updateAnalysisData = (key: string, data: any) => {
    setAnalysisData(prev => ({ ...prev, [key]: data }));
  };

  const downloadAllData = () => {
    // Extract comprehensive data from all sources
    const frameAnalysisLocal = analysisData.frameAnalysisLocal?.data || analysisData.frameAnalysisLocal;
    const frameAnalysisGoogle = analysisData.frameAnalysisGoogle?.data || analysisData.frameAnalysisGoogle;
    
    const dataToDownload = {
      status: analysisData.analysis?.status || 
               (frameAnalysisLocal?.summary?.targetBrandConfirmation?.detected ? 'approved' : 'pending'),
      reelId: analysisData.scraping?.data?.reelId || 
              analysisData.scraping?.reelId || 
              frameAnalysisLocal?.reelId || null,
      campaignId: analysisData.scraping?.campaignId || null,
      timestamp: new Date().toISOString(),
      
      // Scraping data
      scraping: analysisData.scraping,
      
      // Analysis data
      analysis: {
        sentiment: analysisData.analysis?.sentiment || analysisData.analysis?.data?.sentiment,
        niche: analysisData.analysis?.niche || analysisData.analysis?.data?.niche,
        engagement: analysisData.analysis?.engagement || analysisData.analysis?.data?.engagement,
        region: analysisData.analysis?.region || analysisData.analysis?.data?.region,
      },
      
      // Frame analysis
      frameAnalysis: {
        local: frameAnalysisLocal,
        googleVision: frameAnalysisGoogle,
      },
      
      // Objects detected
      objects: frameAnalysisLocal?.objects || 
               frameAnalysisLocal?.summary?.objectsDetected || 
               [],
      
      // Brands detected
      brandsDetected: frameAnalysisLocal?.summary?.brandsDetected?.map((b: any) => b.name) || 
                      frameAnalysisGoogle?.summary?.brands?.map((b: any) => b.name) || 
                      [],
      
      // Target brand confirmation
      targetBrandConfirmation: frameAnalysisLocal?.summary?.targetBrandConfirmation || 
                               frameAnalysisGoogle?.summary?.targetBrandDetection || null,
      
      // Reasons for approval/rejection
      reasons: generateReasons(analysisData),
      
      // Additional metadata
      metadata: {
        videoDuration: frameAnalysisLocal?.videoDuration || 
                       frameAnalysisLocal?.data?.videoDuration ||
                       frameAnalysisGoogle?.videoDuration ||
                       frameAnalysisGoogle?.data?.videoDuration,
        framesAnalyzed: frameAnalysisLocal?.framesAnalyzed || 
                        frameAnalysisLocal?.data?.framesAnalyzed ||
                        frameAnalysisGoogle?.frameCount ||
                        frameAnalysisGoogle?.data?.frameCount,
        processingTime: frameAnalysisLocal?.processingTime || 
                        frameAnalysisGoogle?.processingTime,
        frameCount: frameAnalysisLocal?.data?.frameCount || 
                    frameAnalysisGoogle?.data?.frameCount,
      },
      
      // Full frame analyses (if available)
      frameAnalyses: frameAnalysisLocal?.data?.frameAnalyses || 
                     frameAnalysisGoogle?.data?.frameAnalyses || 
                     null,
      
      // All frames paths
      frames: frameAnalysisLocal?.data?.frames || 
              frameAnalysisGoogle?.data?.frames || 
              null,
    };

    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateReasons = (data: AnalysisData): string[] => {
    const reasons: string[] = [];
    
    const frameLocal = data.frameAnalysisLocal?.data || data.frameAnalysisLocal;
    const frameGoogle = data.frameAnalysisGoogle?.data || data.frameAnalysisGoogle;
    
    // Target brand detection
    if (frameLocal?.summary?.targetBrandConfirmation?.detected) {
      const conf = frameLocal.summary.targetBrandConfirmation;
      reasons.push(
        `Target brand detected${conf.confidence ? ` with ${Math.round(conf.confidence * 100)}% confidence` : ''}`
      );
      if (conf.totalVisibleSeconds) {
        reasons.push(`Product visible for ${conf.totalVisibleSeconds.toFixed(1)} seconds`);
      }
    } else if (frameGoogle?.summary?.targetBrandDetection?.detected) {
      const conf = frameGoogle.summary.targetBrandDetection;
      reasons.push(
        `Target brand detected via Google Vision${conf.confidence ? ` with ${Math.round(conf.confidence * 100)}% confidence` : ''}`
      );
      if (conf.message) {
        reasons.push(conf.message);
      }
    }
    
    // Objects detected
    if (frameLocal?.objects && frameLocal.objects.length > 0) {
      const productObjects = frameLocal.objects.filter((obj: any) => 
        obj.class?.toLowerCase().includes('product') || 
        obj.class?.toLowerCase().includes('bottle') ||
        obj.class?.toLowerCase().includes('package') ||
        obj.class?.toLowerCase().includes('box')
      );
      if (productObjects.length > 0) {
        reasons.push(`${productObjects.length} product-related objects detected`);
      }
    }
    
    // Brands detected
    if (frameLocal?.summary?.brandsDetected?.length > 0) {
      const brandNames = frameLocal.summary.brandsDetected.map((b: any) => b.name).join(', ');
      reasons.push(`Brands detected: ${brandNames}`);
    } else if (frameGoogle?.summary?.brands?.length > 0) {
      const brandNames = frameGoogle.summary.brands.map((b: any) => b.name).join(', ');
      reasons.push(`Brands detected (Google Vision): ${brandNames}`);
    }
    
    // Sentiment analysis
    const sentiment = data.analysis?.sentiment?.data || data.analysis?.sentiment;
    if (sentiment?.overall === 'positive') {
      reasons.push('Positive sentiment detected in content');
    } else if (sentiment?.overall === 'negative') {
      reasons.push('Negative sentiment detected - may need review');
    }
    
    // Niche analysis
    const niche = data.analysis?.niche?.data || data.analysis?.niche;
    if (niche?.primaryNiche) {
      reasons.push(`Niche identified: ${niche.primaryNiche}`);
    }
    
    // Region analysis
    const region = data.analysis?.region?.data || data.analysis?.region;
    if (region?.primaryRegion) {
      reasons.push(`Primary region: ${region.primaryRegion.region}`);
    }
    
    // Engagement analysis
    const engagement = data.analysis?.engagement?.data || data.analysis?.engagement;
    if (engagement?.commentAnalysis?.authenticityScore) {
      const score = engagement.commentAnalysis.authenticityScore;
      if (score > 0.7) {
        reasons.push('High engagement authenticity score');
      } else if (score < 0.3) {
        reasons.push('Low engagement authenticity - potential fake engagement');
      }
    }

    return reasons;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Hamburger Menu */}
        <div className="p-4 border-b border-gray-800">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white hover:text-gray-300 focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('data-scraping')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'data-scraping'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {sidebarOpen && <span>Data Scraping</span>}
          </button>

          <button
            onClick={() => setActiveTab('data-analysis')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'data-analysis'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {sidebarOpen && <span>Data Analysis</span>}
          </button>

          <button
            onClick={() => setActiveTab('frame-analysis-local')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'frame-analysis-local'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {sidebarOpen && <span>Frame Analysis (Local)</span>}
          </button>

          <button
            onClick={() => setActiveTab('frame-analysis-google')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'frame-analysis-google'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {sidebarOpen && <span>Frame Analysis (Google Vision)</span>}
          </button>

          <button
            onClick={() => setActiveTab('engagement')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'engagement'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {sidebarOpen && <span>Engagement Analysis</span>}
          </button>
        </nav>

        {/* Download Button */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={downloadAllData}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-white font-medium"
            >
              Download All Data (JSON)
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'data-scraping' && (
            <DataScrapingTab
              persistedData={analysisData.scraping}
              onDataUpdate={(data) => updateAnalysisData('scraping', data)}
            />
          )}
          {activeTab === 'data-analysis' && (
            <DataAnalysisTab
              scrapingData={analysisData.scraping}
              persistedData={analysisData.analysis}
              onDataUpdate={(data) => updateAnalysisData('analysis', data)}
            />
          )}
          {activeTab === 'frame-analysis-local' && (
            <FrameAnalysisLocalTab
              scrapingData={analysisData.scraping}
              persistedData={analysisData.frameAnalysisLocal}
              onDataUpdate={(data) => updateAnalysisData('frameAnalysisLocal', data)}
            />
          )}
          {activeTab === 'frame-analysis-google' && (
            <FrameAnalysisGoogleVisionTab
              scrapingData={analysisData.scraping}
              persistedData={analysisData.frameAnalysisGoogle}
              onDataUpdate={(data) => updateAnalysisData('frameAnalysisGoogle', data)}
            />
          )}
          {activeTab === 'engagement' && (
            <EngagementAnalysisTab
              scrapingData={analysisData.scraping}
              persistedData={analysisData.engagement}
              onDataUpdate={(data) => updateAnalysisData('engagement', data)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
