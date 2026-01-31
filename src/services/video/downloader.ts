import axios from 'axios';
import { videoStorage } from '@/services/storage/video-storage';
import { externalApiService } from '@/services/external';
import logger from '@/utils/logger';
import { ProcessingError } from '@/utils/errors';
import { validateInstagramReelUrl, extractInstagramReelId } from '@/utils/validation';

/**
 * Video Download Service
 * Downloads videos from various sources (Instagram, direct URLs, etc.)
 */
class VideoDownloader {
  /**
   * Download video from URL
   */
  async downloadVideo(url: string, videoId?: string): Promise<{
    videoId: string;
    filePath: string;
    metadata: {
      url: string;
      size: number;
      downloadedAt: Date;
    };
  }> {
    try {
      const id = videoId || extractInstagramReelId(url) || `video-${Date.now()}`;
      
      logger.info(`Downloading video from: ${url}`);

      // For Instagram reels, use Apify scraper to get video URL
      if (validateInstagramReelUrl(url)) {
        try {
          const reel = await externalApiService.getInstagramReel(url);
          if (reel.videoUrl) {
            logger.info('Using video URL from Apify scraper');
            const filePath = await videoStorage.saveVideoFromUrl(reel.videoUrl, id);
            const size = await videoStorage.getVideoSize(id);
            
            return {
              videoId: id,
              filePath,
              metadata: {
                url: reel.videoUrl,
                size,
                downloadedAt: new Date(),
              },
            };
          } else {
            logger.warn('Apify scraper returned metadata but no videoUrl');
          }
        } catch (error: any) {
          logger.error({ error: error.message }, 'Apify scraper failed to get video URL');
        }
      }

      // Fallback: Try direct download (only for non-Instagram URLs)
      if (!validateInstagramReelUrl(url)) {
        try {
          const filePath = await videoStorage.saveVideoFromUrl(url, id);
          const size = await videoStorage.getVideoSize(id);
          
          return {
            videoId: id,
            filePath,
            metadata: {
              url,
              size,
              downloadedAt: new Date(),
            },
          };
        } catch (error: any) {
          logger.error({ error: error.message }, 'Direct download failed');
          throw new ProcessingError(
            `Failed to download video from URL: ${error.message}. ` +
            `For Instagram reels, please ensure Instagram API or Apify scraper is configured.`,
            error
          );
        }
      } else {
        // For Instagram URLs, if we couldn't get videoUrl from Apify
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment) {
          // In development, allow mock data but log a clear warning
          logger.warn(
            `Could not download Instagram reel video. Using mock path for development. ` +
            `To enable real video analysis, configure Apify scraper with valid credentials (APIFY_API_TOKEN).`
          );
          return {
            videoId: id,
            filePath: `mock://${id}.mp4`,
            metadata: {
              url,
              size: 0,
              downloadedAt: new Date(),
            },
          };
        } else {
          // In production, throw error
          throw new ProcessingError(
            `Could not download Instagram reel video. ` +
            `Please ensure Apify scraper is configured with valid credentials (APIFY_API_TOKEN). ` +
            `The reel metadata was retrieved but the video URL was not available.`
          );
        }
      }
    } catch (error: any) {
      logger.error({ error }, 'Error downloading video:', error);
      throw new ProcessingError(`Failed to download video: ${error.message}`, error);
    }
  }

  /**
   * Check if URL is downloadable
   */
  async isDownloadable(url: string): Promise<boolean> {
    try {
      // For Instagram, check if we can get metadata
      if (validateInstagramReelUrl(url)) {
        const reel = await externalApiService.getInstagramReel(url);
        return !!reel.videoUrl;
      }

      // For direct URLs, try HEAD request
      const response = await axios.head(url, { timeout: 5000 });
      const contentType = response.headers['content-type'] || '';
      return contentType.startsWith('video/') || contentType.includes('mp4');
    } catch {
      return false;
    }
  }
}

export const videoDownloader = new VideoDownloader();
