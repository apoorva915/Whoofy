import { externalApiService } from '@/services/external';
import logger from '@/utils/logger';

/**
 * Speech-to-Text Service
 * Transcribes audio from videos
 */
class SpeechToTextService {
  /**
   * Transcribe video from URL
   */
  async transcribeFromUrl(videoUrl: string): Promise<{
    transcript: string;
    language: string;
    segments: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
    }>;
  }> {
    try {
      const result = await externalApiService.transcribeVideo(videoUrl);
      return {
        transcript: result.transcript,
        language: result.language,
        segments: result.segments.map(seg => ({
          text: seg.text,
          start: seg.start,
          end: seg.end,
          confidence: seg.confidence,
        })),
      };
    } catch (error) {
      logger.error({ error }, 'Error transcribing video:', error);
      // Return empty transcript on error
      return {
        transcript: '',
        language: 'en',
        segments: [],
      };
    }
  }

  /**
   * Transcribe from video file path
   */
  async transcribeFromFile(filePath: string): Promise<{
    transcript: string;
    language: string;
    segments: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
    }>;
  }> {
    // Convert file path to URL (for local files, use file:// protocol)
    const fileUrl = filePath.startsWith('http') ? filePath : `file://${filePath}`;
    return this.transcribeFromUrl(fileUrl);
  }
}

export const speechToText = new SpeechToTextService();
