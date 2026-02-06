import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import * as fs from 'fs-extra';
import { videoProcessor } from '@/services/video/processor';
import { externalApiService } from '@/services/external';
import { validateInstagramReelUrl } from '@/utils/validation';
import logger from '@/utils/logger';
import { logApiConfiguration } from '@/utils/diagnostics';

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type TranscriptionResult = {
  transcript: string;
  language: string;
  processingTimeMs: number;
  segments: any[];
};

/* ------------------------------------------------------------------ */
/* Init */
/* ------------------------------------------------------------------ */

let configLogged = false;
if (!configLogged) {
  configLogged = true;
  logApiConfiguration();
}

/**
 * POST /api/verify
 * Verify a reel submission
 */
export async function POST(request: NextRequest) {
  let body: any = null;

  try {
    body = await request.json();

    if (!body.reelUrl || typeof body.reelUrl !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'reelUrl is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const reelUrl = body.reelUrl as string;

    try {
      new URL(reelUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'Invalid URL format',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!validateInstagramReelUrl(reelUrl) && !reelUrl.startsWith('http')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'Invalid reel URL format',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    logger.info(`Verification request for: ${reelUrl}`);

    const targetBrandName = body.targetBrandName || 'Cadbury Dairy Milk';
    const productNames = Array.isArray(body.productNames) ? body.productNames : [];

    /* ------------------------------------------------------------------ */
    /* Product Images */
    /* ------------------------------------------------------------------ */

    const referenceImagePaths: string[] = [];
    const productImages = body.productImages || (body.productImage ? [body.productImage] : []);

    if (productImages.length > 0) {
      const tempDir = path.join(process.cwd(), 'storage', 'temp');
      await fs.ensureDir(tempDir);

      for (let i = 0; i < productImages.length; i++) {
        try {
          const img = productImages[i];
          let imagePath: string | null = null;

          if (typeof img === 'string' && img.startsWith('data:image/')) {
            const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = img.match(/data:image\/(\w+);base64/)?.[1] || 'jpg';

            imagePath = path.join(tempDir, `product_${Date.now()}_${i}.${ext}`);
            await fs.writeFile(imagePath, buffer);
          } else if (typeof img === 'string' && img.startsWith('http')) {
            const res = await fetch(img);
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              const type = res.headers.get('content-type') || 'image/jpeg';
              const ext = type.split('/')[1] || 'jpg';

              imagePath = path.join(tempDir, `product_${Date.now()}_${i}.${ext}`);
              await fs.writeFile(imagePath, buffer);
            }
          } else if (typeof img === 'string' && (await fs.pathExists(img))) {
            imagePath = img;
          }

          if (imagePath) referenceImagePaths.push(imagePath);
        } catch (error: any) {
          logger.warn({ error: error.message, index: i }, 'Failed to process product image');
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* Video Processing */
    /* ------------------------------------------------------------------ */

    const processingResult = await videoProcessor.processVideo(reelUrl, {
      extractFrames: true,
      frameInterval: 2,
      extractAudio: true,
      recognizeAudio: true,
      analyzeFrames: true,
      targetBrandName,
      productNames,
      analyzeSentiment: false,
      referenceImagePaths: referenceImagePaths.length > 0 ? referenceImagePaths : undefined,
    });

    /* ------------------------------------------------------------------ */
    /* Reel Metadata */
    /* ------------------------------------------------------------------ */

    let reelMetadata: any = null;
    try {
      if (validateInstagramReelUrl(reelUrl)) {
        reelMetadata = await externalApiService.getInstagramReel(reelUrl);
      }
    } catch (error) {
      logger.warn({ error }, 'Could not fetch reel metadata');
    }

    /* ------------------------------------------------------------------ */
    /* Creator Profile */
    /* ------------------------------------------------------------------ */

    let creatorProfile: any = null;
    try {
      if (reelMetadata) {
        let username: string | null = null;

        if (reelMetadata.ownerUsername) {
          username = reelMetadata.ownerUsername;
        } else if (reelMetadata.permalink) {
          const match = reelMetadata.permalink.match(/instagram\.com\/([^\/]+)\/reel\//);
          if (match && match[1] !== 'reel') username = match[1];
        }

        if (username) {
          creatorProfile = await externalApiService.getInstagramProfile(username);
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Could not fetch creator profile');
    }

    /* ------------------------------------------------------------------ */
    /* Transcription – SAFE TYPE NARROWING */
    /* ------------------------------------------------------------------ */

    const transcription =
      processingResult.transcription &&
      typeof processingResult.transcription === 'object' &&
      'transcript' in processingResult.transcription
        ? (processingResult.transcription as TranscriptionResult)
        : null;

    /* ------------------------------------------------------------------ */
    /* Response */
    /* ------------------------------------------------------------------ */

    const visionStoragePath = processingResult.visionAnalysis?.storagePath
      ? processingResult.visionAnalysis.storagePath
          .replace(process.cwd(), '')
          .replace(/\\/g, '/')
      : null;

    const response = {
      success: true,
      data: {
        reelUrl,
        video: {
          id: processingResult.videoId,
          duration: processingResult.duration,
          frameCount: processingResult.frames.length,
          frames: processingResult.frames
            .map((f: string) => {
              if (f.startsWith('mock://')) return null;
              const relative = f.replace(process.cwd(), '').replace(/\\/g, '/');
              return relative.startsWith('/storage/frames/')
                ? relative
                : `/storage/frames/${path.basename(f)}`;
            })
            .filter(Boolean),
        },
        vision: processingResult.visionAnalysis
          ? {
              storagePath: visionStoragePath,
              visualSummary: processingResult.visionAnalysis.visualSummary,
            }
          : null,
        metadata: reelMetadata
          ? {
              caption: reelMetadata.caption,
              likes: reelMetadata.likeCount,
              commentCount: reelMetadata.commentCount,
              views: reelMetadata.playCount,
              timestamp: reelMetadata.timestamp,
            }
          : null,
        creator: creatorProfile
          ? {
              username: creatorProfile.username,
              followers: creatorProfile.followersCount,
              verified: creatorProfile.isVerified,
              bio: creatorProfile.bio,
            }
          : null,
        audio: processingResult.audio
          ? {
              track: processingResult.audio.track,
              confidence: processingResult.audio.confidence,
            }
          : null,
        transcription: transcription
          ? {
              transcript: transcription.transcript,
              language: transcription.language,
              processingTime: transcription.processingTimeMs,
              segments: transcription.segments,
            }
          : null,
        sentiment: null,
        processingTime:
          Date.now() - new Date(processingResult.metadata.downloadedAt).getTime(),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        reelUrl: body?.reelUrl,
      },
      'Verification error'
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: error.message || 'Failed to verify reel',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
