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
  frameAnalyses: FrameAnalysis[];
}

