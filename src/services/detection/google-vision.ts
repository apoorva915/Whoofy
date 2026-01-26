import axios from 'axios';
import * as fs from 'fs-extra';
import path from 'path';
import logger from '@/utils/logger';
import { externalApiConfig, isApiConfigured } from '@/config/external-apis';
import env from '@/config/env';

/**
 * Google Cloud Vision API Feature Types
 */
export enum VisionFeatureType {
  LABEL_DETECTION = 'LABEL_DETECTION',
  TEXT_DETECTION = 'TEXT_DETECTION',
  LOGO_DETECTION = 'LOGO_DETECTION',
  OBJECT_LOCALIZATION = 'OBJECT_LOCALIZATION',
}

/**
 * Google Vision API Response Types
 */
export interface GoogleVisionLabel {
  description: string;
  score: number;
  topicality?: number;
}

export interface GoogleVisionTextAnnotation {
  description: string;
  boundingPoly?: {
    vertices: Array<{ x?: number; y?: number }>;
  };
  locale?: string;
}

export interface GoogleVisionLogo {
  description: string;
  score: number;
  boundingPoly?: {
    vertices: Array<{ x?: number; y?: number }>;
  };
}

export interface GoogleVisionObject {
  name: string;
  score: number;
  boundingPoly?: {
    normalizedVertices: Array<{ x?: number; y?: number }>;
  };
}

export interface GoogleVisionResponse {
  labelAnnotations?: GoogleVisionLabel[];
  textAnnotations?: GoogleVisionTextAnnotation[];
  logoAnnotations?: GoogleVisionLogo[];
  localizedObjectAnnotations?: GoogleVisionObject[];
  fullTextAnnotation?: {
    text: string;
    pages?: Array<{
      property?: {
        detectedLanguages?: Array<{ languageCode: string; confidence?: number }>;
      };
    }>;
  };
}

export interface FrameAnalysisResult {
  labels: Array<{ description: string; confidence: number }>;
  text: string;
  textDetections: Array<{ text: string; confidence?: number }>;
  logos: Array<{ description: string; confidence: number }>;
  objects: Array<{ name: string; confidence: number }>;
  brands: Array<{ name: string; confidence: number; source: 'label' | 'logo' | 'text' }>;
  visualMatches?: Array<{
    referenceImageIndex: number;
    similarity: number;
    match: boolean;
    confidence: 'high' | 'medium' | 'low' | 'none';
    matchingLabels: string[];
    matchingObjects: string[];
    matchingLogos: string[];
  }>;
}

/**
 * Google Cloud Vision API Service
 * Implements label detection, text detection, logo detection, and brand detection
 */
class GoogleVisionService {
  private apiKey: string | undefined;
  private serviceAccountPath: string | undefined;
  private baseUrl: string;
  private isConfiguredFlag: boolean | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.apiKey = externalApiConfig.googleCloud.visionApiKey;
    this.serviceAccountPath = env.GOOGLE_APPLICATION_CREDENTIALS;
    // Use the correct endpoint format: https://vision.googleapis.com/v1/images:annotate
    this.baseUrl = 'https://vision.googleapis.com/v1';
    this.isConfiguredFlag = this.checkConfiguration();
  }

  /**
   * Check if Google Vision API is configured (either via API key or service account)
   */
  private checkConfiguration(): boolean {
    // Check if API key is configured
    if (this.apiKey && this.apiKey.trim().length > 0) {
      return true;
    }
    // Check if service account is configured
    if (this.serviceAccountPath && fs.pathExistsSync(this.serviceAccountPath)) {
      return true;
    }
    return false;
  }

  /**
   * Check if Google Vision API is configured
   */
  isConfigured(): boolean {
    if (this.isConfiguredFlag === null) {
      this.isConfiguredFlag = this.checkConfiguration();
    }
    return this.isConfiguredFlag;
  }

  /**
   * Get access token from service account (for OAuth2 authentication)
   * Uses JWT-based authentication as per Google Cloud service account standards
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.serviceAccountPath || !(await fs.pathExists(this.serviceAccountPath))) {
      throw new Error('Service account file not found');
    }

    try {
      const serviceAccount = await fs.readJSON(this.serviceAccountPath);
      
      // Use Node.js crypto for JWT signing (no external dependency needed)
      const crypto = require('crypto');
      const now = Math.floor(Date.now() / 1000);
      
      // Create JWT header
      const header = {
        alg: 'RS256',
        typ: 'JWT',
      };
      
      // Create JWT claim set
      const claimSet = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600, // Token expires in 1 hour
        scope: 'https://www.googleapis.com/auth/cloud-vision',
      };
      
      // Encode header and claim set
      const base64UrlEncode = (str: string) => {
        return Buffer.from(str)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      };
      
      const encodedHeader = base64UrlEncode(JSON.stringify(header));
      const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
      
      // Create signature
      const signatureInput = `${encodedHeader}.${encodedClaimSet}`;
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(signatureInput);
      const signature = sign.sign(serviceAccount.private_key, 'base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      const jwt = `${encodedHeader}.${encodedClaimSet}.${signature}`;

      // Exchange JWT for access token
      const response = await axios.post('https://oauth2.googleapis.com/token', 
        `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 minute before expiry
      
      return this.accessToken;
    } catch (error: any) {
      logger.error({ error: error?.message }, 'Failed to get access token from service account');
      throw new Error(`Failed to authenticate with service account: ${error?.message}`);
    }
  }

  /**
   * Encode image file to base64
   */
  private async encodeImageToBase64(imagePath: string): Promise<string> {
    const imageBuffer = await fs.readFile(imagePath);
    return imageBuffer.toString('base64');
  }

  /**
   * Call Google Vision API
   */
  private async callVisionAPI(
    imageBase64: string,
    features: VisionFeatureType[]
  ): Promise<GoogleVisionResponse> {
    if (!this.isConfigured()) {
      throw new Error('Google Cloud Vision API is not configured. Please set either GOOGLE_CLOUD_VISION_API_KEY or GOOGLE_APPLICATION_CREDENTIALS environment variables.');
    }

    const requestBody = {
      requests: [
        {
          image: {
            content: imageBase64,
          },
          features: features.map(feature => ({
            type: feature,
            maxResults: 50,
          })),
        },
      ],
    };

    // Determine authentication method
    let url: string;
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey && this.apiKey.trim().length > 0) {
      // Use API key authentication
      url = `${this.baseUrl}/images:annotate?key=${this.apiKey}`;
    } else if (this.serviceAccountPath) {
      // Use service account OAuth2 authentication
      url = `${this.baseUrl}/images:annotate`;
      const accessToken = await this.getAccessToken();
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else {
      throw new Error('No authentication method configured');
    }

    try {
      const response = await axios.post(url, requestBody, {
        headers,
        timeout: 30000, // 30 seconds timeout
      });

      if (response.data.responses && response.data.responses[0]) {
        const result = response.data.responses[0];
        
        // Check for errors
        if (result.error) {
          throw new Error(`Google Vision API error: ${result.error.message || 'Unknown error'}`);
        }

        return result;
      }

      throw new Error('Invalid response from Google Vision API');
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.message;
        logger.error({ error: errorMessage, status: error.response.status }, 'Google Vision API request failed');
        throw new Error(`Google Vision API error: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Analyze a single frame using Google Vision API
   * @param framePath Path to the frame image
   * @param options Analysis options including target brand, product names, additional terms, and reference images
   */
  async analyzeFrame(
    framePath: string,
    options: {
      targetBrand?: string;
      productNames?: string[];
      additionalTerms?: string[];
      referenceImagePaths?: string[];
    } = {}
  ): Promise<FrameAnalysisResult> {
    const { targetBrand, productNames = [], additionalTerms = [], referenceImagePaths = [] } = options;
    if (!(await fs.pathExists(framePath))) {
      logger.warn({ framePath }, 'Frame file does not exist');
      return {
        labels: [],
        text: '',
        textDetections: [],
        logos: [],
        objects: [],
        brands: [],
      };
    }

    try {
      // Encode image to base64
      const imageBase64 = await this.encodeImageToBase64(framePath);

      // Request all features in parallel
      const features = [
        VisionFeatureType.LABEL_DETECTION,
        VisionFeatureType.TEXT_DETECTION,
        VisionFeatureType.LOGO_DETECTION,
        VisionFeatureType.OBJECT_LOCALIZATION,
      ];

      const visionResponse = await this.callVisionAPI(imageBase64, features);

      // Extract labels
      const labels: Array<{ description: string; confidence: number }> = [];
      if (visionResponse.labelAnnotations) {
        visionResponse.labelAnnotations.forEach(label => {
          labels.push({
            description: label.description,
            confidence: label.score || 0,
          });
        });
      }

      // Extract text
      let fullText = '';
      const textDetections: Array<{ text: string; confidence?: number }> = [];
      
      if (visionResponse.fullTextAnnotation?.text) {
        fullText = visionResponse.fullTextAnnotation.text;
      } else if (visionResponse.textAnnotations && visionResponse.textAnnotations.length > 0) {
        // First annotation is usually the full text
        fullText = visionResponse.textAnnotations[0].description || '';
        
        // Remaining annotations are individual text elements
        visionResponse.textAnnotations.slice(1).forEach(annotation => {
          if (annotation.description) {
            textDetections.push({
              text: annotation.description,
            });
          }
        });
      }

      // Extract logos
      const logos: Array<{ description: string; confidence: number }> = [];
      if (visionResponse.logoAnnotations) {
        visionResponse.logoAnnotations.forEach(logo => {
          logos.push({
            description: logo.description,
            confidence: logo.score || 0,
          });
        });
      }

      // Extract objects (object localization)
      const objects: Array<{ name: string; confidence: number }> = [];
      if (visionResponse.localizedObjectAnnotations) {
        visionResponse.localizedObjectAnnotations.forEach(obj => {
          objects.push({
            name: obj.name,
            confidence: obj.score || 0,
          });
        });
      }

      // Detect brands from labels, logos, and text
      // Combine all search terms: target brand, product names, and additional terms
      const allSearchTerms = [
        targetBrand,
        ...productNames,
        ...additionalTerms,
      ].filter((term): term is string => !!term && term.trim().length > 0);
      
      const brands = this.detectBrands(
        labels, 
        logos, 
        fullText, 
        allSearchTerms,
        objects // Include objects for better context
      );

      // Compare with reference images if provided
      const visualMatches = referenceImagePaths.length > 0
        ? await this.compareWithReferenceImages(
            framePath,
            referenceImagePaths,
            { labels, objects, logos }
          )
        : undefined;

      return {
        labels,
        text: fullText,
        textDetections,
        logos,
        objects,
        brands,
        visualMatches,
      };
    } catch (error: any) {
      logger.error(
        {
          error: error?.message,
          framePath,
        },
        'Google Vision frame analysis failed'
      );
      
      return {
        labels: [],
        text: '',
        textDetections: [],
        logos: [],
        objects: [],
        brands: [],
      };
    }
  }

  /**
   * Compare frame with reference images by analyzing both and finding similarities
   * Uses label, object, and logo matching to determine visual similarity
   */
  private async compareWithReferenceImages(
    framePath: string,
    referenceImagePaths: string[],
    frameAnalysis: {
      labels: Array<{ description: string; confidence: number }>;
      objects: Array<{ name: string; confidence: number }>;
      logos: Array<{ description: string; confidence: number }>;
    }
  ): Promise<Array<{
    referenceImageIndex: number;
    similarity: number;
    match: boolean;
    confidence: 'high' | 'medium' | 'low' | 'none';
    matchingLabels: string[];
    matchingObjects: string[];
    matchingLogos: string[];
  }>> {
    const matches: Array<{
      referenceImageIndex: number;
      similarity: number;
      match: boolean;
      confidence: 'high' | 'medium' | 'low' | 'none';
      matchingLabels: string[];
      matchingObjects: string[];
      matchingLogos: string[];
    }> = [];

    // Analyze all reference images
    const referenceAnalyses = await Promise.all(
      referenceImagePaths.map(async (refPath, index) => {
        try {
          if (!(await fs.pathExists(refPath))) {
            return null;
          }

          // Analyze reference image with same features
          const refImageBase64 = await this.encodeImageToBase64(refPath);
          const features = [
            VisionFeatureType.LABEL_DETECTION,
            VisionFeatureType.LOGO_DETECTION,
            VisionFeatureType.OBJECT_LOCALIZATION,
          ];
          
          const refResponse = await this.callVisionAPI(refImageBase64, features);

          const refLabels = (refResponse.labelAnnotations || []).map(l => ({
            description: l.description.toLowerCase(),
            confidence: l.score || 0,
          }));

          const refObjects = (refResponse.localizedObjectAnnotations || []).map(o => ({
            name: o.name.toLowerCase(),
            confidence: o.score || 0,
          }));

          const refLogos = (refResponse.logoAnnotations || []).map(l => ({
            description: l.description.toLowerCase(),
            confidence: l.score || 0,
          }));

          return {
            index,
            labels: refLabels,
            objects: refObjects,
            logos: refLogos,
          };
        } catch (error: any) {
          logger.warn({ error: error?.message, refPath, index }, 'Failed to analyze reference image');
          return null;
        }
      })
    );

    // Compare frame with each reference image
    for (const refAnalysis of referenceAnalyses) {
      if (!refAnalysis) continue;

      // Find matching labels (case-insensitive, fuzzy matching)
      const matchingLabels: string[] = [];
      frameAnalysis.labels.forEach(frameLabel => {
        const frameLabelLower = frameLabel.description.toLowerCase();
        const match = refAnalysis.labels.find(refLabel => {
          const refLabelLower = refLabel.description.toLowerCase();
          // Exact match or contains match
          return frameLabelLower === refLabelLower ||
                 frameLabelLower.includes(refLabelLower) ||
                 refLabelLower.includes(frameLabelLower);
        });
        if (match && match.confidence > 0.5 && frameLabel.confidence > 0.5) {
          matchingLabels.push(frameLabel.description);
        }
      });

      // Find matching objects
      const matchingObjects: string[] = [];
      frameAnalysis.objects.forEach(frameObj => {
        const frameObjLower = frameObj.name.toLowerCase();
        const match = refAnalysis.objects.find(refObj => {
          const refObjLower = refObj.name.toLowerCase();
          return frameObjLower === refObjLower ||
                 frameObjLower.includes(refObjLower) ||
                 refObjLower.includes(frameObjLower);
        });
        if (match && match.confidence > 0.5 && frameObj.confidence > 0.5) {
          matchingObjects.push(frameObj.name);
        }
      });

      // Find matching logos
      const matchingLogos: string[] = [];
      frameAnalysis.logos.forEach(frameLogo => {
        const frameLogoLower = frameLogo.description.toLowerCase();
        const match = refAnalysis.logos.find(refLogo => {
          const refLogoLower = refLogo.description.toLowerCase();
          return frameLogoLower === refLogoLower ||
                 frameLogoLower.includes(refLogoLower) ||
                 refLogoLower.includes(frameLogoLower);
        });
        if (match && match.confidence > 0.5 && frameLogo.confidence > 0.5) {
          matchingLogos.push(frameLogo.description);
        }
      });

      // Calculate similarity score
      // Weight: logos (0.4) > objects (0.35) > labels (0.25)
      const totalPossibleMatches = 
        Math.max(refAnalysis.labels.length, frameAnalysis.labels.length) +
        Math.max(refAnalysis.objects.length, frameAnalysis.objects.length) +
        Math.max(refAnalysis.logos.length, frameAnalysis.logos.length);

      const totalMatches = matchingLabels.length + matchingObjects.length + matchingLogos.length;
      
      let similarity = 0;
      if (totalPossibleMatches > 0) {
        const baseSimilarity = totalMatches / totalPossibleMatches;
        
        // Boost similarity if logos match (strong indicator)
        if (matchingLogos.length > 0) {
          similarity = baseSimilarity * 0.6 + (matchingLogos.length / Math.max(refAnalysis.logos.length, frameAnalysis.logos.length)) * 0.4;
        } else {
          similarity = baseSimilarity;
        }
      }

      // Determine match and confidence
      const matchThreshold = 0.3; // Minimum similarity to consider a match
      const highThreshold = 0.6;
      const mediumThreshold = 0.4;
      
      const isMatch = similarity >= matchThreshold;
      let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
      
      if (isMatch) {
        if (similarity >= highThreshold || matchingLogos.length > 0) {
          confidence = 'high';
        } else if (similarity >= mediumThreshold || matchingObjects.length > 0) {
          confidence = 'medium';
        } else {
          confidence = 'low';
        }
      }

      matches.push({
        referenceImageIndex: refAnalysis.index,
        similarity: Number(similarity.toFixed(3)),
        match: isMatch,
        confidence,
        matchingLabels,
        matchingObjects,
        matchingLogos,
      });
    }

    return matches;
  }

  /**
   * Detect brands from labels, logos, text, and objects
   * @param labels Detected labels
   * @param logos Detected logos
   * @param text Detected text
   * @param searchTerms Array of terms to search for (brand names, product names, additional terms)
   * @param objects Detected objects for context
   */
  private detectBrands(
    labels: Array<{ description: string; confidence: number }>,
    logos: Array<{ description: string; confidence: number }>,
    text: string,
    searchTerms: string[],
    objects: Array<{ name: string; confidence: number }> = []
  ): Array<{ name: string; confidence: number; source: 'label' | 'logo' | 'text' }> {
    const brandMap = new Map<string, { confidence: number; source: 'label' | 'logo' | 'text' }>();

    // Check logos (highest confidence for brand detection)
    logos.forEach(logo => {
      const logoName = logo.description.trim();
      if (logoName.length > 0) {
        const existing = brandMap.get(logoName);
        if (!existing || logo.confidence > existing.confidence) {
          brandMap.set(logoName, {
            confidence: logo.confidence,
            source: 'logo',
          });
        }
      }
    });

    // Check labels for brand-related terms and search terms
    const brandKeywords = ['brand', 'company', 'product', 'logo', 'trademark'];
    labels.forEach(label => {
      const labelLower = label.description.toLowerCase();
      const labelName = label.description.trim();
      
      // Check if label matches any search term
      const matchesSearchTerm = searchTerms.some(term => {
        const termLower = term.toLowerCase();
        return labelLower.includes(termLower) || termLower.includes(labelLower);
      });
      
      const isBrandRelated = brandKeywords.some(keyword => labelLower.includes(keyword));
      
      if (matchesSearchTerm || isBrandRelated || label.confidence > 0.8) {
        if (labelName.length > 0) {
          const existing = brandMap.get(labelName);
          const confidence = matchesSearchTerm ? label.confidence * 0.9 : label.confidence * 0.7;
          if (!existing || confidence > existing.confidence) {
            brandMap.set(labelName, {
              confidence,
              source: 'label',
            });
          }
        }
      }
    });

    // Check objects for search terms
    objects.forEach(obj => {
      const objLower = obj.name.toLowerCase();
      const matchesSearchTerm = searchTerms.some(term => {
        const termLower = term.toLowerCase();
        return objLower.includes(termLower) || termLower.includes(objLower);
      });
      
      if (matchesSearchTerm && obj.confidence > 0.5) {
        const objName = obj.name.trim();
        if (objName.length > 0) {
          const existing = brandMap.get(objName);
          if (!existing || obj.confidence > existing.confidence) {
            brandMap.set(objName, {
              confidence: obj.confidence * 0.6, // Lower confidence for objects
              source: 'label', // Objects are similar to labels
            });
          }
        }
      }
    });

    // Check text for all search terms
    if (text && searchTerms.length > 0) {
      const textLower = text.toLowerCase();
      
      searchTerms.forEach(searchTerm => {
        const termLower = searchTerm.toLowerCase();
        
        // Check if search term appears in text
        if (textLower.includes(termLower)) {
          const existing = brandMap.get(searchTerm);
          if (!existing) {
            brandMap.set(searchTerm, {
              confidence: 0.8, // High confidence for text match
              source: 'text',
            });
          } else if (existing.confidence < 0.8) {
            brandMap.set(searchTerm, {
              confidence: 0.8,
              source: 'text',
            });
          }
        }

        // Also check for partial matches in text
        const termWords = termLower.split(/\s+/);
        termWords.forEach(word => {
          if (word.length > 3 && textLower.includes(word)) {
            const existing = brandMap.get(searchTerm);
            if (!existing) {
              brandMap.set(searchTerm, {
                confidence: 0.6, // Medium confidence for partial match
                source: 'text',
              });
            }
          }
        });
      });
    }

    // Convert to array and sort by confidence
    return Array.from(brandMap.entries())
      .map(([name, data]) => ({
        name,
        confidence: Number(data.confidence.toFixed(3)),
        source: data.source,
      }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze multiple frames
   * @param frames Array of frame paths
   * @param options Analysis options including target brand, product names, additional terms, and reference images
   * @param concurrencyLimit Maximum number of concurrent API calls
   */
  async analyzeFrames(
    frames: string[],
    options: {
      targetBrand?: string;
      productNames?: string[];
      additionalTerms?: string[];
      referenceImagePaths?: string[];
    } = {},
    concurrencyLimit: number = 3
  ): Promise<Array<{ framePath: string; timestamp: number; analysis: FrameAnalysisResult }>> {
    const { targetBrand, productNames = [], additionalTerms = [], referenceImagePaths = [] } = options;
    const results: Array<{ framePath: string; timestamp: number; analysis: FrameAnalysisResult }> = [];

    // Process frames in batches to respect rate limits
    for (let i = 0; i < frames.length; i += concurrencyLimit) {
      const batch = frames.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (framePath, idx) => {
        const frameIndex = i + idx;
        // Estimate timestamp (assuming 2 second intervals, can be made configurable)
        const timestamp = frameIndex * 2;
        
        try {
          const analysis = await this.analyzeFrame(framePath, {
            targetBrand,
            productNames,
            additionalTerms,
            referenceImagePaths,
          });
          return {
            framePath,
            timestamp,
            analysis,
          };
        } catch (error: any) {
          logger.error(
            {
              error: error?.message,
              framePath,
              timestamp,
            },
            'Failed to analyze frame with Google Vision'
          );
          return {
            framePath,
            timestamp,
            analysis: {
              labels: [],
              text: '',
              textDetections: [],
              logos: [],
              objects: [],
              brands: [],
            },
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Log progress
      if (frames.length > concurrencyLimit && (i + concurrencyLimit) % (concurrencyLimit * 3) === 0) {
        logger.info(`Processed ${Math.min(i + concurrencyLimit, frames.length)}/${frames.length} frames with Google Vision`);
      }
    }

    return results;
  }
}

export const googleVisionService = new GoogleVisionService();
