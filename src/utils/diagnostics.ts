import { isApiConfigured } from '@/config/external-apis';
import logger from '@/utils/logger';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';

/**
 * Log API configuration status
 */
export function logApiConfiguration(): void {
  logger.info('=== API Configuration Status ===');
  
  const apis = [
    { name: 'Instagram (RapidAPI)', configured: isApiConfigured('instagram') },
    { name: 'Apify', configured: isApiConfigured('apify') },
    { name: 'Shazam (RapidAPI)', configured: isApiConfigured('shazam') },
    { name: 'OpenAI Whisper', configured: isApiConfigured('openai') },
    { name: 'NoteGPT', configured: isApiConfigured('notegpt') },
  ];

  apis.forEach(api => {
    const status = api.configured ? '✅ Configured' : '⚠️  Not configured (using mocks)';
    logger.info(`${api.name}: ${status}`);
  });

  // Check FFmpeg
  const ffmpegStatus = ffmpegPath ? '✅ Available' : '⚠️  Not found (using system FFmpeg)';
  const ffprobeStatus = ffprobePath?.path ? '✅ Available' : '⚠️  Not found (using system FFprobe)';
  
  logger.info(`FFmpeg: ${ffmpegStatus}`);
  logger.info(`FFprobe: ${ffprobeStatus}`);
  
  logger.info('================================');
}

/**
 * Get API configuration summary
 */
export function getApiConfigurationSummary(): {
  apis: Record<string, boolean>;
  ffmpeg: boolean;
  ffprobe: boolean;
} {
  return {
    apis: {
      instagram: isApiConfigured('instagram'),
      apify: isApiConfigured('apify'),
      shazam: isApiConfigured('shazam'),
      openai: isApiConfigured('openai'),
      notegpt: isApiConfigured('notegpt'),
    },
    ffmpeg: !!ffmpegPath,
    ffprobe: !!ffprobePath?.path,
  };
}





