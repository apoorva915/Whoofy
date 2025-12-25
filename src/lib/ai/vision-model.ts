import { FrameAnalysis } from '@/types/vision';
import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import path from 'path';
import logger from '@/utils/logger';

/**
 * Object class names that might indicate brands/products
 * Used to boost confidence when brand text is detected along with related objects
 */
const BRAND_RELATED_OBJECTS = [
  'bottle',
  'cup',
  'can',
  'pack',
  'package',
  'box',
  'bag',
  'container',
  'food',
  'chocolate',
  'candy',
  'snack',
  'sandwich', // Sometimes YOLO detects chocolate bars as sandwiches
  'donut',
  'cake',
  'cookie',
];

/**
 * Vision Model wrapper
 * Uses YOLO (via Python) for object detection and OCR for text reading
 */
class VisionModel {
  private pythonCommand: string;
  private yoloScriptPath: string;
  private ocrScriptPath: string;
  private yoloAvailable: boolean | null = null;
  private ocrAvailable: boolean | null = null;

  constructor() {
    // Use same Python command as Whisper
    this.pythonCommand = process.env.LOCAL_WHISPER_PYTHON || 
      (process.platform === 'win32' 
        ? path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
        : path.join(process.cwd(), '.venv', 'bin', 'python'));
    
    this.yoloScriptPath = path.join(process.cwd(), 'yolo', 'detect.py');
    this.ocrScriptPath = path.join(process.cwd(), 'yolo', 'ocr.py');
  }

  /**
   * Check if YOLO is available
   */
  private async checkYoloAvailable(): Promise<boolean> {
    if (this.yoloAvailable !== null) {
      return this.yoloAvailable;
    }

    try {
      // Check if Python script exists
      if (!(await fs.pathExists(this.yoloScriptPath))) {
        logger.warn('YOLO script not found, will use OCR-only mode');
        this.yoloAvailable = false;
        return false;
      }

      // Try to import ultralytics (quick check)
      // We'll do a real test on first actual detection
      this.yoloAvailable = true; // Will be validated on first use
      
      if (!this.yoloAvailable) {
        logger.warn('YOLO not available (ultralytics may not be installed). Will use OCR-only mode.');
        logger.info('To enable YOLO, run: pip install ultralytics opencv-python-headless');
      } else {
        logger.info('YOLO is available');
      }
      
      return this.yoloAvailable;
    } catch (error: any) {
      logger.warn({ error: error?.message }, 'YOLO check failed, will use OCR-only mode');
      this.yoloAvailable = false;
      return false;
    }
  }

  /**
   * Run YOLO detection via Python subprocess
   */
  private async runYoloCommand(args: string[]): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const scriptArgs = [this.yoloScriptPath, ...args];
      
      const child = spawn(this.pythonCommand, scriptArgs, {
        cwd: process.cwd(),
        env: process.env,
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`YOLO process failed: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`YOLO exited with code ${code}: ${stderr || stdout}`));
          return;
        }

        try {
          // Remove ANSI escape codes and clean the output
          const cleanOutput = stdout
            .replace(/\u001b\[[0-9;]*m/g, '') // Remove ANSI color codes
            .replace(/\u001b\[K/g, '') // Remove clear line codes
            .replace(/\r/g, '') // Remove carriage returns
            .trim();
          
          // Extract JSON from output (in case there's extra text)
          const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
          const jsonString = jsonMatch ? jsonMatch[0] : cleanOutput;
          
          const result = JSON.parse(jsonString);
          if (result.error) {
            reject(new Error(result.error));
            return;
          }
          resolve(result.objects || []);
        } catch (parseError: any) {
          logger.debug({ stdout, stderr, parseError: parseError.message }, 'YOLO output parsing failed');
          reject(new Error(`Failed to parse YOLO output: ${parseError.message}. Output: ${stdout.substring(0, 200)}`));
        }
      });
    });
  }

  isConfigured(): boolean {
    return this.yoloAvailable === true;
  }

  /**
   * Analyze a single frame
   * Detects objects, brands, and reads text
   * @param framePath Path to the frame image
   * @param timestamp Timestamp of the frame in seconds
   * @param targetBrand Target brand name (e.g., "Cadbury Dairy Milk" or "Cadbury")
   * @param productNames Optional array of product names to detect (e.g., ["Silk Brownie", "Dairy Milk"])
   */
  async analyzeFrame(
    framePath: string,
    timestamp: number,
    targetBrand = 'Cadbury Dairy Milk',
    productNames: string[] = []
  ): Promise<FrameAnalysis> {
    // Skip mock frames
    if (framePath.startsWith('mock://')) {
      return {
        timestamp,
        objects: [],
        brands: [],
      };
    }

    try {
      // Check if file exists
      if (!(await fs.pathExists(framePath))) {
        logger.warn({ framePath }, 'Frame file does not exist');
        return {
          timestamp,
          objects: [],
          brands: [],
        };
      }

      // Run object detection and OCR in parallel
      const [objects, ocrText] = await Promise.all([
        this.detectObjects(framePath),
        this.readText(framePath),
      ]);

      // Filter out false positive detections
      const filteredObjects = this.filterFalsePositives(objects, ocrText);

      // Extract brands from objects and OCR text using dynamic brand/product detection
      const brands = this.detectBrands(filteredObjects, ocrText, targetBrand, productNames);

      // Log detected objects and OCR text for debugging (all frames)
      logger.debug(
        { 
          timestamp,
          objects: filteredObjects, 
          ocrTextPreview: ocrText.substring(0, 200),
          ocrTextLength: ocrText.length,
          brandsDetected: brands.map(b => `${b.name} (${b.confidence})`).join(', '),
          brandsCount: brands.length,
          framePath 
        },
        `Frame ${timestamp}s detection results`
      );

      return {
        timestamp,
        objects: filteredObjects,
        brands,
      };
    } catch (error: any) {
      logger.error(
        {
          error: error?.message,
          framePath,
          timestamp,
        },
        'Frame analysis failed'
      );
    return {
      timestamp,
      objects: [],
      brands: [],
    };
    }
  }

  /**
   * Detect objects in frame using YOLO (Python)
   * Always attempts to run - will return empty array if unavailable
   */
  private async detectObjects(framePath: string): Promise<string[]> {
    // Check if YOLO script exists
    if (!(await fs.pathExists(this.yoloScriptPath))) {
      if (this.yoloAvailable === null) {
        logger.warn('YOLO script not found');
        this.yoloAvailable = false;
      }
      return [];
    }

    try {
      // Normalize path to absolute
      const absolutePath = path.isAbsolute(framePath) 
        ? framePath 
        : path.resolve(process.cwd(), framePath);

      // Always attempt YOLO detection with higher confidence threshold for accuracy
      // Increased from 0.4 to 0.5 to reduce false positives
      const objects = await this.runYoloCommand([absolutePath, '0.5']);
      
      // Mark as available if successful
      if (this.yoloAvailable !== true) {
        this.yoloAvailable = true;
        logger.info('YOLO is working correctly');
      }
      
      return objects;
    } catch (error: any) {
      // Log error but don't permanently disable - dependencies might be installed later
      const errorMsg = error?.message || 'Unknown error';
      
      // Only log warning on first failure or if status changed from available to unavailable
      if (this.yoloAvailable === null || this.yoloAvailable === true) {
        this.yoloAvailable = false;
        if (errorMsg.includes('ultralytics')) {
          logger.warn('YOLO not available. Install with: pip install ultralytics opencv-python-headless');
        } else {
          logger.warn({ error: errorMsg }, 'YOLO object detection failed');
        }
      }
      
      // Return empty array but allow retries on next frame
      return [];
    }
  }

  /**
   * Read text from frame using OCR (Python pytesseract)
   * Always attempts to run - will return empty string if unavailable
   */
  private async readText(framePath: string): Promise<string> {
    // Always attempt OCR - Tesseract might have been installed or become available

    // Check if OCR script exists
    if (!(await fs.pathExists(this.ocrScriptPath))) {
      if (this.ocrAvailable === null) {
        logger.warn('OCR script not found');
        this.ocrAvailable = false;
      }
      return '';
    }

    try {
      // Normalize path to absolute
      const absolutePath = path.isAbsolute(framePath) 
        ? framePath 
        : path.resolve(process.cwd(), framePath);

      // Ensure file exists
      if (!(await fs.pathExists(absolutePath))) {
        logger.warn({ framePath: absolutePath }, 'OCR: Frame file does not exist');
        return '';
      }

      // Always attempt OCR
      const text = await this.runOcrCommand([absolutePath]);
      
      // Mark as available if successful
      if (this.ocrAvailable !== true) {
        this.ocrAvailable = true;
        logger.info('OCR is working correctly');
      }
      
      // Log if OCR returned empty text (might indicate an issue)
      if (!text || text.trim().length === 0) {
        logger.debug({ framePath: absolutePath }, 'OCR returned empty text');
      }
      
      return text;
    } catch (error: any) {
      // Log error but don't permanently disable - Tesseract might be installed later
      const errorMsg = error?.message || '';
      
      // Only log warning on first failure or if status changed from available to unavailable
      if (this.ocrAvailable === null || this.ocrAvailable === true) {
        this.ocrAvailable = false;
        if (errorMsg.includes('tesseract is not installed') || errorMsg.includes('PATH')) {
          logger.warn('Tesseract OCR not found. Install Tesseract OCR engine to enable text detection.');
          logger.info('Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki or use: choco install tesseract');
        } else {
          logger.warn({ error: errorMsg, framePath }, 'OCR failed for frame');
        }
      } else {
        // Log individual frame OCR failures even if OCR was already marked as unavailable
        logger.debug({ error: errorMsg, framePath }, 'OCR failed for individual frame');
      }
      
      // Return empty string but allow retries on next frame
      return '';
    }
  }

  /**
   * Run OCR detection via Python subprocess
   */
  private async runOcrCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const scriptArgs = [this.ocrScriptPath, ...args];
      
      const child = spawn(this.pythonCommand, scriptArgs, {
        cwd: process.cwd(),
        env: process.env,
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`OCR process failed: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`OCR exited with code ${code}: ${stderr || stdout}`));
          return;
        }

        try {
          // Remove ANSI escape codes and clean the output
          const cleanOutput = stdout
            .replace(/\u001b\[[0-9;]*m/g, '') // Remove ANSI color codes
            .replace(/\u001b\[K/g, '') // Remove clear line codes
            .replace(/\r/g, '') // Remove carriage returns
            .trim();
          
          // Extract JSON from output (in case there's extra text)
          const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
          const jsonString = jsonMatch ? jsonMatch[0] : cleanOutput;
          
          const result = JSON.parse(jsonString);
          if (result.error) {
            reject(new Error(result.error));
            return;
          }
          resolve(result.text || '');
        } catch (parseError: any) {
          logger.debug({ stdout, stderr, parseError: parseError.message }, 'OCR output parsing failed');
          reject(new Error(`Failed to parse OCR output: ${parseError.message}. Output: ${stdout.substring(0, 200)}`));
        }
      });
    });
  }

  /**
   * Filter out false positive object detections
   * Removes common misclassifications like "book" when food/packaging is present
   */
  private filterFalsePositives(objects: string[], ocrText: string): string[] {
    const foodKeywords = ['chocolate', 'candy', 'food', 'snack', 'brownie', 'silk', 'cadbury', 'dairy', 'milk'];
    const packagingKeywords = ['box', 'package', 'pack', 'container', 'bottle', 'can'];
    const ocrTextLower = ocrText.toLowerCase();
    
    // Check if food/packaging keywords are present in OCR or objects
    const hasFoodContext = foodKeywords.some(keyword => 
      ocrTextLower.includes(keyword) || objects.some(obj => obj.includes(keyword))
    );
    const hasPackagingContext = packagingKeywords.some(keyword =>
      objects.some(obj => obj.includes(keyword))
    );
    
    // Filter out false positives
    return objects.filter(obj => {
      const objLower = obj.toLowerCase();
      
      // Remove "book" if food/packaging context is present (common YOLO misclassification)
      if (objLower === 'book' && (hasFoodContext || hasPackagingContext)) {
        logger.debug({ obj, reason: 'False positive: book detected in food/packaging context' }, 'Filtered false positive');
        return false;
      }
      
      // Remove "laptop" if food context is present (another common misclassification)
      if ((objLower === 'laptop' || objLower === 'keyboard') && hasFoodContext) {
        logger.debug({ obj, reason: 'False positive: laptop/keyboard detected in food context' }, 'Filtered false positive');
        return false;
      }
      
      return true;
    });
  }

  /**
   * Extract brand and product names from target brand string
   * Example: "Cadbury Dairy Milk" -> brand: "Cadbury", products: ["Dairy Milk"]
   * Example: "Cadbury Dairy Milk Silk Brownie" -> brand: "Cadbury", products: ["Dairy Milk", "Silk Brownie", "Silk", "Brownie"]
   */
  private parseBrandAndProducts(targetBrand: string, productNames: string[] = []): {
    brand: string;
    products: string[];
    allTerms: string[];
  } {
    // Extract brand name (typically the first word)
    const parts = targetBrand.trim().split(/\s+/);
    const brand = parts[0] || targetBrand;
    
    // Extract product names from targetBrand (everything after the brand name)
    const productsFromBrand: string[] = [];
    if (parts.length > 1) {
      // Add full product name (e.g., "Dairy Milk")
      const fullProduct = parts.slice(1).join(' ');
      productsFromBrand.push(fullProduct);
      
      // Add individual product words if they make sense (e.g., "Dairy", "Milk")
      if (parts.length > 2) {
        parts.slice(1).forEach((part, idx) => {
          // Add multi-word combinations
          if (idx < parts.length - 2) {
            productsFromBrand.push(`${parts[idx + 1]} ${parts[idx + 2]}`);
          }
        });
      }
    }
    
    // Combine with provided product names
    const allProducts = [...new Set([...productsFromBrand, ...productNames])];
    
    // Extract individual words from product names for better matching
    // e.g., "Silk Brownie" -> also search for "Silk" and "Brownie" separately
    const productWords: string[] = [];
    allProducts.forEach(product => {
      const words = product.trim().split(/\s+/).filter(w => w.length > 2); // Only words longer than 2 chars
      productWords.push(...words);
    });
    
    // Create all terms to search for (brand + products + individual words + full target brand)
    const allTerms = [
      brand,
      targetBrand, // Full target brand string
      ...allProducts,
      ...productWords, // Individual words from products
    ];
    
    return {
      brand,
      products: allProducts,
      allTerms: [...new Set(allTerms)], // Remove duplicates
    };
  }

  /**
   * Normalize OCR text for better matching (handle common OCR errors)
   */
  private normalizeOcrText(text: string): string {
    // Remove extra whitespace and normalize
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s]/g, ' ') // Replace special chars with space (OCR often adds noise)
      .toLowerCase()
      .trim();
  }

  /**
   * Check if a term appears in OCR text with flexible matching
   * Handles OCR variations like extra spaces, case differences, etc.
   */
  private matchesInText(term: string, ocrText: string): { found: boolean; occurrences: number; hasUppercase: boolean } {
    const termLower = term.toLowerCase().trim();
    const normalizedOcr = this.normalizeOcrText(ocrText);
    
    // Try exact match first
    let occurrences = 0;
    const regex = new RegExp(termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = normalizedOcr.match(regex);
    occurrences = matches ? matches.length : 0;
    
    // Check for word boundary matches (more reliable)
    const wordBoundaryRegex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const wordBoundaryMatches = normalizedOcr.match(wordBoundaryRegex);
    const wordBoundaryOccurrences = wordBoundaryMatches ? wordBoundaryMatches.length : 0;
    
    // Use word boundary count if available (more accurate)
    if (wordBoundaryOccurrences > 0) {
      occurrences = wordBoundaryOccurrences;
    }
    
    // Check for multi-word terms (e.g., "silk brownie") - check if all words appear
    const termWords = termLower.split(/\s+/).filter(w => w.length > 0);
    if (termWords.length > 1) {
      // Check if all words appear (even if not together)
      const allWordsPresent = termWords.every(word => normalizedOcr.includes(word));
      if (allWordsPresent) {
        // Check if they appear close together (within reasonable distance)
        const firstWordIndex = normalizedOcr.indexOf(termWords[0]);
        if (firstWordIndex !== -1) {
          const remainingText = normalizedOcr.substring(firstWordIndex);
          // Check if remaining words appear in sequence (allowing for some spacing)
          let foundSequence = true;
          let searchStart = 0;
          for (let i = 1; i < termWords.length; i++) {
            const wordIndex = remainingText.indexOf(termWords[i], searchStart);
            if (wordIndex === -1 || wordIndex > 50) { // Words too far apart
              foundSequence = false;
              break;
            }
            searchStart = wordIndex + termWords[i].length;
          }
          
          if (foundSequence && occurrences === 0) {
            occurrences = 1; // Found as sequence even if exact match failed
          }
        }
      }
    }
    
    const found = occurrences > 0 || normalizedOcr.includes(termLower);
    const hasUppercase = ocrText.includes(term) || ocrText.includes(term.toUpperCase());
    
    return { found, occurrences: found ? Math.max(occurrences, 1) : 0, hasUppercase };
  }

  /**
   * Detect brands from objects and OCR text based on target brand and product names
   */
  private detectBrands(
    objects: string[],
    ocrText: string,
    targetBrand: string,
    productNames: string[] = []
  ): Array<{ name: string; confidence: number }> {
    const detectedBrands: Map<string, number> = new Map();
    
    // Parse brand and products from target brand string
    const { brand, products, allTerms } = this.parseBrandAndProducts(targetBrand, productNames);
    
    // Check each term in OCR text with flexible matching
    allTerms.forEach((term) => {
      const termLower = term.toLowerCase().trim();
      
      // Skip empty terms
      if (!termLower) return;
      
      // Use flexible matching
      const matchResult = this.matchesInText(term, ocrText);
      
      if (matchResult.found) {
        const occurrences = matchResult.occurrences;
        
        // Base confidence
        let confidence = 0.5;
        
        // Boost confidence for multiple occurrences
        confidence += Math.min(0.2, occurrences * 0.05);
        
        // Boost confidence for uppercase appearance
        if (matchResult.hasUppercase) {
          confidence += 0.2;
        }
        
        // Higher confidence for full target brand match
        if (term === targetBrand) {
          confidence += 0.15;
        }
        
        // Higher confidence for brand name match
        if (term === brand) {
          confidence += 0.1;
        }
        
        // Higher confidence for product names
        if (products.includes(term)) {
          confidence += 0.1;
        }
        
        confidence = Math.min(0.95, confidence);
        
        detectedBrands.set(term, Math.max(detectedBrands.get(term) || 0, confidence));
      }
    });
    
    // Check for compound matches (e.g., "Cadbury Dairy Milk" when searching for "Cadbury" and "Dairy Milk")
    const fullTargetMatch = this.matchesInText(targetBrand, ocrText);
    if (fullTargetMatch.found && !detectedBrands.has(targetBrand)) {
      // Full match found
      const occurrences = fullTargetMatch.occurrences;
      const hasUppercase = fullTargetMatch.hasUppercase;
      let confidence = 0.7 + (occurrences * 0.05) + (hasUppercase ? 0.15 : 0);
      confidence = Math.min(0.95, confidence);
      detectedBrands.set(targetBrand, confidence);
    }
    
    // Boost confidence if brand-related objects are detected
    const hasBrandRelatedObject = objects.some((obj) =>
      BRAND_RELATED_OBJECTS.some((related) => obj.includes(related))
    );
    
    if (hasBrandRelatedObject) {
      detectedBrands.forEach((confidence, brand) => {
        detectedBrands.set(brand, Math.min(0.95, confidence + 0.1));
      });
    }
    
    // Convert to array format and sort by confidence
    return Array.from(detectedBrands.entries())
      .map(([name, confidence]) => ({
        name,
        confidence: Number(confidence.toFixed(3)),
      }))
      .sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending
  }
}

export const visionModel = new VisionModel();
