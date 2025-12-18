import { externalApiService } from '@/services/external';
import logger from '@/utils/logger';

/**
 * Caption Extraction Service
 * Extracts captions from Instagram reels and other sources
 */
class CaptionExtractor {
  /**
   * Extract caption from Instagram reel URL
   */
  async extractCaption(reelUrl: string): Promise<string | null> {
    try {
      const reel = await externalApiService.getInstagramReel(reelUrl);
      return reel.caption;
    } catch (error) {
      logger.error({ error }, 'Error extracting caption:', error);
      return null;
    }
  }

  /**
   * Extract caption from reel metadata
   */
  extractFromMetadata(metadata: { caption?: string | null }): string | null {
    return metadata.caption || null;
  }
}

export const captionExtractor = new CaptionExtractor();
