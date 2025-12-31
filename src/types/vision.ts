/**
 * Visual Similarity Result from CLIP
 */
export interface VisualSimilarity {
  similarity: number; // 0-1, cosine similarity score
  match: boolean; // true if similarity >= threshold
  confidence: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Frame Analysis Result
 * Result of analyzing a single frame
 */
export interface FrameAnalysis {
  timestamp: number; // in seconds
  objects: string[];
  brands: {
    name: string;
    confidence: number; // 0–1
  }[];
  visualSimilarity?: VisualSimilarity; // CLIP similarity if reference image provided
}

/**
 * Visual Summary
 * Aggregated results from all frames
 */
export interface VisualSummary {
  uniqueObjects: string[];
  brandsDetected: {
    name: string;
    confidence: number;
    totalFrames: number;
    totalVisibleSeconds?: number;
  }[];
  // Brand confirmation - explicitly states if target brand/product was detected
  targetBrandConfirmation: {
    detected: boolean;
    message: string; // e.g., "Yes, it shows Dairy Milk" or "No, Dairy Milk was not detected"
    confidence: number;
    detectedInFrames: number;
    totalVisibleSeconds?: number;
  };
  // Visual sentiment - positive/negative publicity assessment
  visualSentiment: {
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number; // -1 to 1, where 1 is very positive, -1 is very negative
    reasoning: string; // Explanation of why this sentiment was determined
    confidence: number;
  };
  // Visual similarity summary (if reference image provided)
  visualSimilaritySummary?: {
    averageSimilarity: number;
    maxSimilarity: number;
    matchedFrames: number;
    totalFrames: number;
    visibleSeconds?: number;
  };
  frameAnalyses: FrameAnalysis[];
}

/**
 * Vision Analysis Result
 * Full payload returned by the vision pipeline
 */
export interface VisionAnalysisResult {
  frameAnalyses: FrameAnalysis[];
  visualSummary: VisualSummary;
  storagePath?: string;
}

