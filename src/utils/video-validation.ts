import fs from 'fs-extra';
import path from 'path';
import logger from './logger';

/**
 * Validate video file before processing
 * Checks if file is complete, stable, and has valid MP4 structure
 */
export async function validateVideoFile(
  filePath: string,
  options: {
    maxWaitTime?: number; // Maximum time to wait for file stability (ms)
    checkInterval?: number; // Interval between checks (ms)
    minFileSize?: number; // Minimum file size in bytes
  } = {}
): Promise<{ valid: boolean; error?: string }> {
  const {
    maxWaitTime = 5000, // 5 seconds
    checkInterval = 500, // 500ms
    minFileSize = 1024, // 1KB minimum
  } = options;

  try {
    // Check if file exists
    if (!(await fs.pathExists(filePath))) {
      return { valid: false, error: 'Video file does not exist' };
    }

    // Wait for file to be stable (size doesn't change)
    const startTime = Date.now();
    let lastSize = 0;
    let stableCount = 0;
    const requiredStableChecks = 3; // File size must be stable for 3 consecutive checks

    while (Date.now() - startTime < maxWaitTime) {
      const stats = await fs.stat(filePath);
      const currentSize = stats.size;

      // Check minimum file size
      if (currentSize < minFileSize) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }

      // Check if file size is stable
      if (currentSize === lastSize) {
        stableCount++;
        if (stableCount >= requiredStableChecks) {
          logger.debug({
            filePath,
            size: currentSize,
            waitTime: Date.now() - startTime,
          }, 'Video file is stable');
          break;
        }
      } else {
        stableCount = 0;
        lastSize = currentSize;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    // Final size check
    const finalStats = await fs.stat(filePath);
    if (finalStats.size < minFileSize) {
      return { valid: false, error: `Video file is too small: ${finalStats.size} bytes` };
    }

    // Check if file size is still changing (might be incomplete)
    if (stableCount < requiredStableChecks) {
      logger.warn({
        filePath,
        size: finalStats.size,
        stableCount,
      }, 'Video file size may still be changing - proceeding with caution');
    }

    // Validate MP4 structure by checking for "moov" atom
    // MP4 files should have "ftyp" at the start and "moov" atom somewhere
    const buffer = await fs.readFile(filePath, { start: 0, end: Math.min(8192, finalStats.size - 1) });
    
    // Check for MP4 signature: "ftyp" should be at offset 4
    const ftypIndex = buffer.indexOf(Buffer.from('ftyp'));
    if (ftypIndex === -1 || ftypIndex > 8) {
      // Try reading more of the file to find moov atom
      const largerBuffer = await fs.readFile(filePath, { start: 0, end: Math.min(1024 * 1024, finalStats.size - 1) });
      const moovIndex = largerBuffer.indexOf(Buffer.from('moov'));
      
      if (moovIndex === -1) {
        return {
          valid: false,
          error: 'Invalid MP4 file: moov atom not found (file may be incomplete or corrupted)',
        };
      }
      
      logger.debug({ filePath, moovIndex }, 'Found moov atom in MP4 file');
    }

    return { valid: true };
  } catch (error: any) {
    logger.error({ error: error.message, filePath }, 'Error validating video file');
    return { valid: false, error: `Validation error: ${error.message}` };
  }
}

/**
 * Wait for file to be stable (size doesn't change)
 */
export async function waitForFileStable(
  filePath: string,
  maxWaitTime: number = 5000,
  checkInterval: number = 500
): Promise<boolean> {
  const startTime = Date.now();
  let lastSize = 0;
  let stableCount = 0;
  const requiredStableChecks = 2;

  while (Date.now() - startTime < maxWaitTime) {
    try {
      if (!(await fs.pathExists(filePath))) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }

      const stats = await fs.stat(filePath);
      const currentSize = stats.size;

      if (currentSize === lastSize && currentSize > 0) {
        stableCount++;
        if (stableCount >= requiredStableChecks) {
          return true;
        }
      } else {
        stableCount = 0;
        lastSize = currentSize;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      // File might not exist yet, continue waiting
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  return false;
}


