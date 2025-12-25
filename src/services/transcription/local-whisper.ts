import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import ffmpegPathRaw from 'ffmpeg-static';
import logger from '@/utils/logger';
import env from '@/config/env';

/**
 * Resolve ffmpeg path, handling Next.js bundling artifacts
 */
function resolveFfmpegPath(): string | null {
  if (!ffmpegPathRaw) return null;
  
  let resolved = ffmpegPathRaw;
  
  // Fix Next.js bundling issue where paths get transformed (\\ROOT\\ -> actual path)
  if (resolved.includes('\\ROOT\\') || resolved.includes('/ROOT/')) {
    const cwd = process.cwd();
    // Replace \\ROOT\\ or /ROOT/ with actual cwd
    resolved = resolved.replace(/[\\\/]ROOT[\\\/]/g, cwd + path.sep);
  }
  
  // Ensure absolute path
  if (!path.isAbsolute(resolved)) {
    resolved = path.resolve(process.cwd(), resolved);
  }
  
  // Verify file exists
  if (fs.existsSync(resolved)) {
    return resolved;
  }
  
  // Fallback: try to find ffmpeg in node_modules
  const fallbackPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(fallbackPath)) {
    logger.warn(`Using fallback ffmpeg path: ${fallbackPath}`);
    return fallbackPath;
  }
  
  logger.warn(`FFmpeg not found at: ${resolved}`);
  return resolved; // Return anyway, let it fail with better error
}

const ffmpegPath = resolveFfmpegPath();

/**
 * Segment returned by Whisper CLI JSON output
 */
export interface LocalWhisperSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

/**
 * Normalized transcription result for the Node pipeline
 */
export interface LocalWhisperTranscriptionResult {
  transcript: string;
  language: string;
  segments: LocalWhisperSegment[];
  processingTimeMs: number;
  outputJsonPath: string;
}

export type LocalWhisperTask = 'transcribe' | 'translate';

/**
 * Local Whisper transcriber that shells out to the Python CLI added under /whisper
 */
class LocalWhisperTranscriber {
  private readonly pythonCommand: string;
  private readonly modelName: string;
  private readonly device: string;
  private readonly defaultTask: LocalWhisperTask;
  private readonly outputDir: string;

  constructor() {
    this.pythonCommand = env.LOCAL_WHISPER_PYTHON || 'python';
    this.modelName = env.LOCAL_WHISPER_MODEL || 'tiny';
    this.device = env.LOCAL_WHISPER_DEVICE || 'cpu';
    this.defaultTask = env.LOCAL_WHISPER_TASK || 'transcribe';
    this.outputDir = path.join(process.cwd(), 'storage', 'temp', 'transcriptions');
  }

  /**
   * Transcribe the provided audio file and return the normalized result
   */
  async transcribe(
    audioPath: string,
    options?: {
      language?: string;
      task?: LocalWhisperTask;
    }
  ): Promise<LocalWhisperTranscriptionResult> {
    const startTime = Date.now();
    await fs.ensureDir(this.outputDir);

    // Normalize the audio path to absolute path (required for Whisper on Windows)
    const absoluteAudioPath = path.isAbsolute(audioPath) 
      ? audioPath 
      : path.resolve(process.cwd(), audioPath);
    
    // Verify the audio file exists
    if (!(await fs.pathExists(absoluteAudioPath))) {
      throw new Error(`Audio file not found: ${absoluteAudioPath}`);
    }

    const normalizedTask = options?.task || this.defaultTask;
    const jsonPath = this.getOutputJsonPath(absoluteAudioPath);
    await fs.remove(jsonPath).catch(() => undefined);

    // Use normalized absolute path for Whisper
    const args: string[] = [
      '-m',
      'whisper.transcribe',
      absoluteAudioPath,
      '--model',
      this.modelName,
      '--output_dir',
      this.outputDir,
      '--output_format',
      'json',
      '--task',
      normalizedTask,
      '--device',
      this.device,
      '--verbose',
      'False',
    ];

    if (options?.language) {
      args.push('--language', options.language);
    }

    logger.info(`Running local Whisper (${this.modelName}) for ${path.basename(audioPath)}`);
    await this.runWhisperCommand(args);

    if (!(await fs.pathExists(jsonPath))) {
      throw new Error(`Whisper output not found: ${jsonPath}`);
    }

    const data = await fs.readJson(jsonPath).catch((error) => {
      throw new Error(`Failed to parse Whisper JSON: ${error.message}`);
    });

    const segments = this.normalizeSegments(Array.isArray(data?.segments) ? data.segments : []);
    const transcript = typeof data?.text === 'string' ? data.text : '';

    return {
      transcript,
      language: typeof data?.language === 'string' ? data.language : options?.language || 'unknown',
      segments,
      processingTimeMs: Date.now() - startTime,
      outputJsonPath: jsonPath,
    };
  }

  /**
   * Run the Python CLI with the provided args and resolve/reject based on exit code
   */
  private runWhisperCommand(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure we use the correct Python and add whisper directory to PYTHONPATH
      const env = this.getEnvWithFfmpeg();
      const whisperDir = path.join(process.cwd(), 'whisper');
      const pathDelimiter = process.platform === 'win32' ? ';' : ':';
      const currentPythonPath = env.PYTHONPATH || '';
      env.PYTHONPATH = currentPythonPath 
        ? `${whisperDir}${pathDelimiter}${currentPythonPath}`
        : whisperDir;
      
      // Ensure PATH is set correctly (Windows is case-insensitive but some tools check both)
      if (process.platform === 'win32') {
        env.Path = env.PATH;
      }
      
      // Log environment setup for debugging
      logger.debug({
        pythonCommand: this.pythonCommand,
        whisperDir,
        pythonPath: env.PYTHONPATH,
        ffmpegPath: ffmpegPath,
        ffmpegDir: ffmpegPath ? path.dirname(ffmpegPath) : 'not found',
        pathEnv: env.PATH?.substring(0, 200), // Log first 200 chars
      }, 'Running Whisper with environment');
      
      const child = spawn(this.pythonCommand, args, {
        cwd: process.cwd(),
        env,
        shell: process.platform === 'win32', // Use shell on Windows for better PATH handling
      });

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString().trim();
        if (text) {
          logger.debug(`[Local Whisper stdout] ${text}`);
        }
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString().trim();
        if (text) {
          logger.debug(`[Local Whisper stderr] ${text}`);
        }
      });

      child.on('error', (error) => {
        logger.error({ error }, 'Local Whisper process failed');
        reject(error);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Local Whisper exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Normalize segments from Whisper JSON output into a lightweight interface
   */
  private normalizeSegments(rawSegments: Array<any>): LocalWhisperSegment[] {
    return rawSegments.map((segment) => ({
      text: (segment?.text ?? '').trim(),
      start: typeof segment?.start === 'number' ? segment.start : 0,
      end: typeof segment?.end === 'number' ? segment.end : 0,
      confidence: this.calculateConfidence(segment?.avg_logprob),
    }));
  }

  private calculateConfidence(avgLogprob?: number): number {
    const logprob = Number.isFinite(avgLogprob) ? avgLogprob : -5;
    const confidence = Math.min(1, Math.max(0, 1 + logprob / 5));
    return Number(confidence.toFixed(3));
  }

  /**
   * Compute the expected JSON output path for the provided audio file
   */
  private getOutputJsonPath(audioPath: string): string {
    const baseName = path.basename(audioPath, path.extname(audioPath));
    return path.join(this.outputDir, `${baseName}.json`);
  }

  /**
   * Ensure ffmpeg binary is available to the Python subprocess
   */
  private getEnvWithFfmpeg(): NodeJS.ProcessEnv {
    const nextEnv = { ...process.env };
    if (ffmpegPath) {
      const ffmpegDir = path.dirname(ffmpegPath);
      const currentPath = nextEnv.PATH || nextEnv.Path || '';
      const pathDelimiter = process.platform === 'win32' ? ';' : ':';
      const pathParts = currentPath.split(pathDelimiter).filter(Boolean);
      
      // Add ffmpeg directory to PATH if not already present
      if (!pathParts.includes(ffmpegDir)) {
        pathParts.unshift(ffmpegDir);
      }
      
      // Set both PATH and Path (Windows uses both)
      nextEnv.PATH = pathParts.join(pathDelimiter);
      if (process.platform === 'win32') {
        nextEnv.Path = nextEnv.PATH;
      }
      
      logger.debug(`FFmpeg directory added to PATH: ${ffmpegDir}`);
      logger.debug(`FFmpeg executable: ${ffmpegPath}`);
    } else {
      logger.warn('FFmpeg path not found - transcription may fail');
    }
    return nextEnv;
  }
}

export const localWhisperTranscriber = new LocalWhisperTranscriber();

