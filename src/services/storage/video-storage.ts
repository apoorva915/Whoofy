import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Local Video Storage Service
 * Stores videos and related files in local filesystem
 */
class VideoStorageService {
  private baseDir: string;
  private videosDir: string;
  private framesDir: string;
  private tempDir: string;

  constructor() {
    // Use project root /storage directory
    this.baseDir = path.join(process.cwd(), 'storage');
    this.videosDir = path.join(this.baseDir, 'videos');
    this.framesDir = path.join(this.baseDir, 'frames');
    this.tempDir = path.join(this.baseDir, 'temp');

    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure all storage directories exist
   */
  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.videosDir);
    await fs.ensureDir(this.framesDir);
    await fs.ensureDir(this.tempDir);
  }

  /**
   * Save video file
   */
  async saveVideo(buffer: Buffer, filename?: string): Promise<string> {
    await this.ensureDirectories();
    
    const videoId = filename || uuidv4();
    const filePath = path.join(this.videosDir, `${videoId}.mp4`);
    
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Save video from URL (downloads and saves)
   */
  async saveVideoFromUrl(url: string, videoId?: string): Promise<string> {
    const axios = (await import('axios')).default;
    
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 300000, // 5 minutes
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      // Validate response data
      if (!response.data || response.data.byteLength === 0) {
        throw new Error('Downloaded video file is empty');
      }

      const buffer = Buffer.from(response.data);
      
      // Validate buffer size
      if (buffer.length === 0) {
        throw new Error('Video buffer is empty');
      }

      const filePath = await this.saveVideo(buffer, videoId);
      
      // Verify file was written correctly
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        throw new Error('Video file was written but is empty');
      }

      if (stats.size !== buffer.length) {
        throw new Error(`File size mismatch: expected ${buffer.length} bytes, got ${stats.size} bytes`);
      }

      return filePath;
    } catch (error: any) {
      // Clean up partial file if it exists
      if (videoId) {
        const filePath = this.getVideoPath(videoId);
        try {
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  /**
   * Get video path
   */
  getVideoPath(videoId: string): string {
    return path.join(this.videosDir, `${videoId}.mp4`);
  }

  /**
   * Check if video exists
   */
  async videoExists(videoId: string): Promise<boolean> {
    const filePath = this.getVideoPath(videoId);
    return fs.pathExists(filePath);
  }

  /**
   * Save frame image
   */
  async saveFrame(buffer: Buffer, videoId: string, frameNumber: number): Promise<string> {
    await this.ensureDirectories();
    
    const filename = `${videoId}_frame_${frameNumber}.jpg`;
    const filePath = path.join(this.framesDir, filename);
    
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Get frame path
   */
  getFramePath(videoId: string, frameNumber: number): string {
    return path.join(this.framesDir, `${videoId}_frame_${frameNumber}.jpg`);
  }

  /**
   * Delete video and all related frames
   */
  async deleteVideo(videoId: string): Promise<void> {
    const videoPath = this.getVideoPath(videoId);
    await fs.remove(videoPath);

    // Delete all frames for this video
    const frames = await fs.readdir(this.framesDir);
    for (const frame of frames) {
      if (frame.startsWith(`${videoId}_frame_`)) {
        await fs.remove(path.join(this.framesDir, frame));
      }
    }
  }

  /**
   * Get video file size
   */
  async getVideoSize(videoId: string): Promise<number> {
    try {
      const filePath = this.getVideoPath(videoId);
      if (!(await fs.pathExists(filePath))) {
        return 0;
      }
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Clean up old files (older than specified days)
   */
  async cleanupOldFiles(daysOld: number = 7): Promise<void> {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    // Clean videos
    const videos = await fs.readdir(this.videosDir);
    for (const video of videos) {
      const videoPath = path.join(this.videosDir, video);
      const stats = await fs.stat(videoPath);
      if (stats.mtime.getTime() < cutoffTime) {
        await fs.remove(videoPath);
      }
    }

    // Clean frames
    const frames = await fs.readdir(this.framesDir);
    for (const frame of frames) {
      const framePath = path.join(this.framesDir, frame);
      const stats = await fs.stat(framePath);
      if (stats.mtime.getTime() < cutoffTime) {
        await fs.remove(framePath);
      }
    }
  }
}

export const videoStorage = new VideoStorageService();



