import { Sentiment, DetectedObject, DetectedBrand, BrandMention } from './verification';

/**
 * Object Detection Result
 */
export interface ObjectDetectionResult {
  objects: DetectedObject[];
  processingTimeMs: number;
}

/**
 * Brand Detection Result
 */
export interface BrandDetectionResult {
  brands: DetectedBrand[];
  processingTimeMs: number;
}

/**
 * Text Detection Result (OCR)
 */
export interface TextDetectionResult {
  text: string[];
  textRegions: Array<{
    text: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  processingTimeMs: number;
}

/**
 * Brand Mention Detection Result
 */
export interface BrandMentionDetectionResult {
  mentions: BrandMention[];
  processingTimeMs: number;
}

/**
 * Sentiment Analysis Result
 */
export interface SentimentAnalysisResult {
  sentiment: Sentiment;
  score: number; // -1 (negative) to 1 (positive)
  confidence: number; // 0-1
  processingTimeMs: number;
}

/**
 * Transcription Result
 */
export interface TranscriptionResult {
  transcript: string;
  language: string;
  segments: Array<{
    text: string;
    start: number; // seconds
    end: number; // seconds
    confidence: number;
  }>;
  processingTimeMs: number;
}

/**
 * Audio Recognition Result (Shazam)
 */
export interface AudioRecognitionResult {
  track: {
    title: string;
    artist: string;
    album?: string;
  } | null;
  confidence: number;
  processingTimeMs: number;
}








