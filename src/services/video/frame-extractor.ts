import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import logger from '@/utils/logger';
import { ProcessingError } from '@/utils/errors';

const execAsync = promisify(exec);

/**
 * Frame Extraction Service
 * Extracts frames from videos for AI analysis
 */
class FrameExtractor {
  private getFfmpegPath(): string {
    if (ffmpegPath) {
      // ffmpeg-static returns an absolute path
      // In Next.js, paths might be transformed during build, so we need to handle that
      try {
        // Check if the path exists as-is
        if (fs.existsSync(ffmpegPath)) {
          return ffmpegPath;
        }
        
        // Try resolving it (in case it's relative in the build)
        const resolved = path.resolve(ffmpegPath);
        if (fs.existsSync(resolved)) {
          return resolved;
        }
        
        // In Next.js builds, the path might be in a different location
        // Try to find it relative to process.cwd()
        const cwdRelative = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
        if (fs.existsSync(cwdRelative)) {
          return cwdRelative;
        }
        
        logger.warn(`FFmpeg not found at: ${ffmpegPath}, trying system FFmpeg`);
      } catch (error) {
        logger.warn({ error }, 'Error checking FFmpeg path');
      }
      // Return the path anyway - it might work in the execution context
      return ffmpegPath;
    }
    // Fallback to system ffmpeg if static binary not available
    return 'ffmpeg';
  }

  private getFfprobePath(): string {
    if (ffprobePath?.path) {
      try {
        // Check if the path exists
        if (fs.existsSync(ffprobePath.path)) {
          return ffprobePath.path;
        }
        // If it doesn't exist, try resolving it
        const resolved = path.resolve(ffprobePath.path);
        if (fs.existsSync(resolved)) {
          return resolved;
        }
        logger.warn(`FFprobe not found at: ${ffprobePath.path}, trying system FFprobe`);
      } catch (error) {
        logger.warn({ error }, 'Error checking FFprobe path');
      }
      return ffprobePath.path;
    }
    // Fallback to system ffprobe if static binary not available
    return 'ffprobe';
  }

  /**
   * Extract frames from video
   * @param videoPath Path to video file
   * @param videoId Unique video identifier
   * @param options Extraction options
   */
  async extractFrames(
    videoPath: string,
    videoId: string,
    options: {
      interval?: number; // Extract frame every N seconds
      count?: number; // Extract N frames total
      quality?: number; // JPEG quality (1-100)
    } = {}
  ): Promise<string[]> {
    const { interval = 2, count, quality = 90 } = options;

    try {
      // Check if video exists (skip if mock path)
      if (videoPath.startsWith('mock://')) {
        logger.warn('Mock video path detected, returning mock frames');
        return this.getMockFrames(videoId, count || 5);
      }

      if (!(await fs.pathExists(videoPath))) {
        throw new ProcessingError(`Video file not found: ${videoPath}`);
      }

      logger.info(`Extracting frames from: ${videoPath}`);

      const ffmpeg = this.getFfmpegPath();
      const framesDir = path.join(process.cwd(), 'storage', 'frames');
      await fs.ensureDir(framesDir);

      const outputPattern = path.join(framesDir, `${videoId}_frame_%03d.jpg`);

      // Build ffmpeg command
      // On Windows, use forward slashes for paths in commands
      const normalizePath = (p: string) => {
        return p.replace(/\\/g, '/');
      };
      
      const normalizedFfmpeg = normalizePath(ffmpeg);
      const normalizedVideoPath = normalizePath(videoPath);
      const normalizedOutputPattern = normalizePath(outputPattern);
      
      let command: string;
      if (count) {
        // Extract specific number of frames evenly spaced
        const fps = 1 / interval;
        command = `"${normalizedFfmpeg}" -i "${normalizedVideoPath}" -vf "fps=${fps},scale=640:-1" -vframes ${count} -q:v ${quality} "${normalizedOutputPattern}"`;
      } else {
        // Extract frames at interval
        const fps = 1 / interval;
        command = `"${normalizedFfmpeg}" -i "${normalizedVideoPath}" -vf "fps=${fps},scale=640:-1" -q:v ${quality} "${normalizedOutputPattern}"`;
      }

      logger.debug(`Running FFmpeg command: ${command}`);
      logger.debug(`FFmpeg path: ${ffmpeg}`);
      logger.debug(`FFmpeg path exists: ${fs.existsSync(ffmpeg)}`);
      
      // On Windows, use shell: true to properly handle paths with spaces
      if (process.platform === 'win32') {
        await execAsync(command, { shell: true });
      } else {
      await execAsync(command);
      }

      // Get all extracted frame files
      const files = await fs.readdir(framesDir);
      const frameFiles = files
        .filter(f => f.startsWith(`${videoId}_frame_`) && f.endsWith('.jpg'))
        .sort()
        .map(f => path.join(framesDir, f));

      if (frameFiles.length === 0) {
        logger.warn('No frames extracted, returning mock frames');
        return this.getMockFrames(videoId, count || 5);
      }

      logger.info(`Extracted ${frameFiles.length} frames`);
      return frameFiles;
    } catch (error: any) {
      logger.error({
        error: error.message,
        stack: error.stack,
        videoPath,
        videoId,
      }, 'Error extracting frames');
      // Only return mock frames if it's a real error, not a processing error
      if (error instanceof ProcessingError) {
        throw error;
      }
      logger.warn('Falling back to mock frames due to extraction error');
      return this.getMockFrames(videoId, count || 5);
    }
  }

  /**
   * Extract frame at specific timestamp
   */
  async extractFrameAtTime(
    videoPath: string,
    videoId: string,
    timestamp: number // seconds
  ): Promise<string | null> {
    try {
      if (videoPath.startsWith('mock://')) {
        return this.getMockFrames(videoId, 1)[0] || null;
      }

      if (!(await fs.pathExists(videoPath))) {
        return null;
      }

      const ffmpeg = this.getFfmpegPath();
      const framesDir = path.join(process.cwd(), 'storage', 'frames');
      await fs.ensureDir(framesDir);

      const outputPath = path.join(framesDir, `${videoId}_frame_${timestamp}s.jpg`);

      // Normalize paths for Windows (use forward slashes)
      const normalizePath = (p: string) => {
        return p.replace(/\\/g, '/');
      };
      
      const normalizedFfmpeg = normalizePath(ffmpeg);
      const normalizedVideoPath = normalizePath(videoPath);
      const normalizedOutputPath = normalizePath(outputPath);
      const command = `"${normalizedFfmpeg}" -i "${normalizedVideoPath}" -ss ${timestamp} -vframes 1 -q:v 90 "${normalizedOutputPath}"`;
      
      // On Windows, use cmd /c to properly handle quotes
      if (process.platform === 'win32') {
        await execAsync(command, { shell: true });
      } else {
      await execAsync(command);
      }

      if (await fs.pathExists(outputPath)) {
        return outputPath;
      }

      return null;
    } catch (error: any) {
      logger.error({
        error: error.message,
        timestamp,
        videoPath,
      }, 'Error extracting frame at time');
      return null;
    }
  }

  /**
   * Get mock frames (for development/testing)
   */
  private getMockFrames(videoId: string, count: number): string[] {
    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      frames.push(`mock://${videoId}_frame_${i}.jpg`);
    }
    return frames;
  }

  /**
   * Get video duration
   */
  async getVideoDuration(videoPath: string): Promise<number> {
    try {
      if (videoPath.startsWith('mock://')) {
        return 30; // Mock duration
      }

      if (!(await fs.pathExists(videoPath))) {
        logger.warn(`Video file not found for duration check: ${videoPath}`);
        return 0;
      }

      const ffprobe = this.getFfprobePath();
      
      // Normalize paths for Windows (use forward slashes)
      const normalizePath = (p: string) => {
        return p.replace(/\\/g, '/');
      };
      
      const normalizedFfprobe = normalizePath(ffprobe);
      const normalizedVideoPath = normalizePath(videoPath);
      const command = `"${normalizedFfprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${normalizedVideoPath}"`;
      
      // On Windows, use cmd /c to properly handle quotes
      const { stdout } = process.platform === 'win32' 
        ? await execAsync(command, { shell: true })
        : await execAsync(command);
      const duration = parseFloat(stdout.trim());
      
      if (isNaN(duration) || duration <= 0) {
        logger.warn(`Invalid duration extracted: ${duration}, defaulting to 30s`);
        return 30;
      }
      
      return duration;
    } catch (error: any) {
      logger.error({
        error: error.message,
        videoPath,
      }, 'Error getting video duration');
      return 30; // Default duration
    }
  }
}

export const frameExtractor = new FrameExtractor();
