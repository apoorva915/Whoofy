import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';
import ffmpegPath from 'ffmpeg-static';
import logger from '@/utils/logger';
import { ProcessingError } from '@/utils/errors';

const execAsync = promisify(exec);

/**
 * Audio Extraction Service
 * Extracts audio from videos for transcription and analysis
 */
class AudioExtractor {
  private getFfmpegPath(): string {
    if (ffmpegPath) {
      // ffmpeg-static returns an absolute path
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

  /**
   * Extract audio from video file
   * @param videoPath Path to video file
   * @param options Extraction options
   * @returns Path to extracted audio file
   */
  async extractAudio(
    videoPath: string,
    options: {
      format?: 'mp3' | 'wav' | 'm4a'; // Audio format
      sampleRate?: number; // Sample rate in Hz (default: 16000 for Whisper)
      channels?: number; // Number of audio channels (1 for mono, 2 for stereo)
      bitrate?: string; // Audio bitrate (e.g., '128k')
    } = {}
  ): Promise<string> {
    const {
      format = 'mp3',
      sampleRate = 16000, // Whisper works best with 16kHz
      channels = 1, // Mono is sufficient for speech
      bitrate = '128k',
    } = options;

    try {
      // Check if video exists (skip if mock path)
      if (videoPath.startsWith('mock://')) {
        throw new ProcessingError('Cannot extract audio from mock video');
      }

      if (!(await fs.pathExists(videoPath))) {
        throw new ProcessingError(`Video file not found: ${videoPath}`);
      }

      // Validate video file before processing
      const { validateVideoFile } = await import('@/utils/video-validation');
      const validation = await validateVideoFile(videoPath, {
        maxWaitTime: 5000,
        checkInterval: 500,
        minFileSize: 1024,
      });

      if (!validation.valid) {
        throw new ProcessingError(
          `Cannot extract audio: Video file is invalid or incomplete. ${validation.error || 'Unknown error'}`
        );
      }

      logger.info(`Extracting audio from: ${videoPath}`);

      const ffmpeg = this.getFfmpegPath();
      const audioDir = path.join(process.cwd(), 'storage', 'temp');
      await fs.ensureDir(audioDir);

      // Generate unique audio filename
      const videoId = path.basename(videoPath, path.extname(videoPath));
      const audioFilename = `${videoId}_audio_${Date.now()}.${format}`;
      const audioPath = path.join(audioDir, audioFilename);

      // Build ffmpeg command to extract audio
      // Normalize paths for Windows (use forward slashes)
      const normalizePath = (p: string) => {
        return p.replace(/\\/g, '/');
      };
      
      const normalizedFfmpeg = normalizePath(ffmpeg);
      const normalizedVideoPath = normalizePath(videoPath);
      const normalizedAudioPath = normalizePath(audioPath);
      
      // FFmpeg command to extract audio:
      // -i: input file
      // -vn: disable video
      // -ac: audio channels (1 for mono, 2 for stereo)
      // -ar: audio sample rate
      // -ab: audio bitrate
      // -f: output format
      const command = `"${normalizedFfmpeg}" -i "${normalizedVideoPath}" -vn -ac ${channels} -ar ${sampleRate} -ab ${bitrate} -f ${format} "${normalizedAudioPath}"`;

      logger.debug(`Running FFmpeg command: ${command}`);
      logger.debug(`FFmpeg path: ${ffmpeg}`);
      logger.debug(`FFmpeg path exists: ${fs.existsSync(ffmpeg)}`);
      
      // On Windows, use shell: true to properly handle paths with spaces
      if (process.platform === 'win32') {
        await execAsync(command, { shell: true });
      } else {
        await execAsync(command);
      }

      // Verify audio file was created
      if (!(await fs.pathExists(audioPath))) {
        throw new ProcessingError(`Audio extraction failed: ${audioPath} was not created`);
      }

      const stats = await fs.stat(audioPath);
      if (stats.size === 0) {
        throw new ProcessingError(`Audio extraction failed: ${audioPath} is empty`);
      }

      logger.info(`Audio extracted successfully: ${audioPath} (${(stats.size / 1024).toFixed(2)} KB)`);
      return audioPath;
    } catch (error: any) {
      logger.error({
        error: error.message,
        stack: error.stack,
        videoPath,
      }, 'Error extracting audio');
      
      if (error instanceof ProcessingError) {
        throw error;
      }
      
      throw new ProcessingError(`Failed to extract audio: ${error.message}`);
    }
  }

  /**
   * Extract audio and return as buffer
   * Useful for APIs that accept buffers directly
   */
  async extractAudioBuffer(
    videoPath: string,
    options: {
      format?: 'mp3' | 'wav' | 'm4a';
      sampleRate?: number;
      channels?: number;
      bitrate?: string;
    } = {}
  ): Promise<Buffer> {
    const audioPath = await this.extractAudio(videoPath, options);
    const buffer = await fs.readFile(audioPath);
    
    // Clean up temp file
    try {
      await fs.remove(audioPath);
    } catch (error) {
      logger.warn({ error, audioPath }, 'Failed to clean up temp audio file');
    }
    
    return buffer;
  }

  /**
   * Clean up old audio files (older than specified hours)
   */
  async cleanupOldAudioFiles(hoursOld: number = 1): Promise<void> {
    try {
      const audioDir = path.join(process.cwd(), 'storage', 'temp');
      if (!(await fs.pathExists(audioDir))) {
        return;
      }

      const cutoffTime = Date.now() - hoursOld * 60 * 60 * 1000;
      const files = await fs.readdir(audioDir);
      
      for (const file of files) {
        if (file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a')) {
          const filePath = path.join(audioDir, file);
          try {
            const stats = await fs.stat(filePath);
            if (stats.mtime.getTime() < cutoffTime) {
              await fs.remove(filePath);
              logger.debug(`Cleaned up old audio file: ${file}`);
            }
          } catch (error) {
            // Ignore errors for individual files
            logger.warn({ error, filePath }, 'Error cleaning up audio file');
          }
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Error during audio cleanup');
    }
  }
}

export const audioExtractor = new AudioExtractor();



