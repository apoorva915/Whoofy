import { NextRequest, NextResponse } from 'next/server';
import { externalApiService } from '@/services/external';
import { apifyScraper } from '@/services/external/apify-scraper';
import { validateInstagramReelUrl } from '@/utils/validation';
import logger from '@/utils/logger';

/**
 * POST /api/profile
 * Scrape profile data for a reel URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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

    let reelUrl = body.reelUrl;

    if (!reelUrl.startsWith('http://') && !reelUrl.startsWith('https://')) {
      reelUrl = `https://${reelUrl}`;
    }

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

    logger.info(`Profile scraping request for: ${reelUrl}`);

    let apifyReelData: any = null;
    let apifySources: string[] = [];

    try {
      if (apifyScraper.isConfigured() && validateInstagramReelUrl(reelUrl)) {
        apifyReelData = await apifyScraper.scrapeReel(reelUrl);
        apifySources.push(
          'apify-reel-scraper',
          'apify-post-scraper',
          'apify-instagram-scraper',
          'apify-comments-scraper'
        );
      }
    } catch (error) {
      logger.warn({ error }, 'Apify scrapers failed');
    }

    let reelMetadata: any = null;
    if (!apifyReelData) {
      try {
        if (validateInstagramReelUrl(reelUrl)) {
          reelMetadata = await externalApiService.getInstagramReel(reelUrl);
        }
      } catch (error) {
        logger.error({ error }, 'Failed to fetch reel metadata');
      }
    }

    let creatorProfile: any = null;
    let creatorSource = 'none';

    try {
      let username: string | null = null;

      if (apifyReelData?.ownerUsername) {
        username = apifyReelData.ownerUsername;
      } else if (reelMetadata?.ownerUsername) {
        username = reelMetadata.ownerUsername;
      } else if (reelMetadata?.permalink) {
        const match = reelMetadata.permalink.match(/instagram\.com\/([^\/]+)\/reel\//);
        if (match && match[1] !== 'reel') {
          username = match[1];
        }
      }

      if (username && apifyScraper.isConfigured()) {
        try {
          const apifyProfile = await apifyScraper.scrapeProfile(username);
          creatorProfile = {
            username: apifyProfile.username,
            followers: apifyProfile.followersCount,
            verified: apifyProfile.isVerified,
            bio: apifyProfile.biography,
            accountType: apifyProfile.isBusinessAccount ? 'BUSINESS' : 'CREATOR',
            following: apifyProfile.followingCount,
            mediaCount: apifyProfile.postsCount,
            profilePictureUrl: apifyProfile.profilePictureUrl,
            website: apifyProfile.externalUrl,
            profileId: apifyProfile.profileId,
            location: apifyProfile.location,
            joinDate: apifyProfile.joinDate,
            videoCount: apifyProfile.videoCount,
            highlightReelsCount: apifyProfile.highlightReelsCount,
            businessCategory: apifyProfile.businessCategory,
            relatedProfiles: apifyProfile.relatedProfiles,
            latestPosts: apifyProfile.latestPosts,
            igtvVideoCount: apifyProfile.igtvVideoCount,
            usernameChangeCount: apifyProfile.usernameChangeCount,
            isRecentlyJoined: apifyProfile.isRecentlyJoined,
            verifiedDate: apifyProfile.verifiedDate,
            facebookId: apifyProfile.facebookId,
          };
          creatorSource = 'apify-profile-scraper';
        } catch (error) {
          logger.warn({ error }, 'Apify profile scraper failed');
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Creator profile fetch failed');
    }

    const metadata = apifyReelData
      ? {
          caption: apifyReelData.caption,
          transcript: apifyReelData.transcript,
          likes: apifyReelData.likeCount,
          commentCount: apifyReelData.commentCount,
          views: apifyReelData.playCount,
          shares: apifyReelData.shareCount,
          timestamp: apifyReelData.timestamp,
          duration: apifyReelData.duration,
          hashtags: apifyReelData.hashtags,
          mentions: apifyReelData.mentions,
          taggedUsers: apifyReelData.taggedUsers,
          videoUrl: apifyReelData.videoUrl,
          thumbnailUrl: apifyReelData.thumbnailUrl,
          musicInfo: apifyReelData.musicInfo,
          isSponsored: apifyReelData.isSponsored,
          commentsDisabled: apifyReelData.commentsDisabled,
          coAuthors: apifyReelData.coAuthors,
          mediaDimensions: apifyReelData.mediaDimensions,

          comments:
            Array.isArray(apifyReelData.comments) && apifyReelData.comments.length > 0
              ? apifyReelData.comments.slice(0, 200)
              : [],

          postType: apifyReelData.postType,
          isPinned: apifyReelData.isPinned,
          isPaidPartnership: apifyReelData.isPaidPartnership,
          childPosts: apifyReelData.childPosts,
          imageUrls: apifyReelData.imageUrls,
          imageAltText: apifyReelData.imageAltText,
          imageDimensions: apifyReelData.imageDimensions,
          replyCount: apifyReelData.replyCount,
          postOwnerInfo: apifyReelData.postOwnerInfo,
        }
      : reelMetadata
      ? {
          caption: reelMetadata.caption,
          transcript: null,
          likes: reelMetadata.likeCount,
          commentCount: reelMetadata.commentCount,
          views: reelMetadata.playCount,
          shares: null,
          timestamp: reelMetadata.timestamp,
          duration: null,
          hashtags: [],
          mentions: [],
          taggedUsers: [],
          videoUrl: null,
          thumbnailUrl: null,
          musicInfo: null,
          isSponsored: false,
          commentsDisabled: false,
          coAuthors: [],
          mediaDimensions: null,
          comments: [],
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        reelUrl,
        metadata,
        creator: creatorProfile,
        sources: {
          reel: apifyReelData ? apifySources : [],
          creator: creatorSource !== 'none' ? [creatorSource] : [],
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error({ error }, 'Profile scraping error');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROFILE_ERROR',
          message: error.message || 'Failed to scrape profile',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
