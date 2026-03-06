import { NextRequest, NextResponse } from 'next/server';
import { externalApiService } from '@/services/external';
import { apifyScraper } from '@/services/external/apify-scraper';
import { instaloaderMl } from '@/services/external/instaloader-ml';
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

    let reelData: any = null;
    let sourcesReel: string[] = [];

    // Primary: Instaloader via ML service
    if (instaloaderMl.isConfigured() && validateInstagramReelUrl(reelUrl)) {
      try {
        const instaloaderReel = await instaloaderMl.fetchReel(reelUrl);
        const instaloaderComments = instaloaderReel.comments.map((c) => ({
          id: c.id,
          text: c.text,
          author: c.owner_username,
          ownerUsername: c.owner_username,
          ownerProfilePicUrl: null,
          timestamp: new Date(c.timestamp),
          likes: c.likes_count,
          likesCount: c.likes_count,
          repliesCount: 0,
          replies: [],
        }));

        reelData = {
          id: instaloaderReel.id,
          shortcode: instaloaderReel.shortcode,
          url: instaloaderReel.url,
          caption: instaloaderReel.caption,
          transcript: null,
          likeCount: instaloaderReel.like_count,
          commentCount: instaloaderReel.comment_count,
          playCount: instaloaderReel.play_count,
          shareCount: null,
          timestamp: new Date(instaloaderReel.timestamp),
          duration: null,
          hashtags: instaloaderReel.hashtags,
          mentions: instaloaderReel.mentions,
          taggedUsers: [],
          videoUrl: instaloaderReel.video_url,
          thumbnailUrl: instaloaderReel.thumbnail_url,
          musicInfo: null,
          isSponsored: false,
          commentsDisabled: false,
          coAuthors: [],
          mediaDimensions: null,
          comments: instaloaderComments,
          postType: 'REEL',
          isPinned: false,
          isPaidPartnership: false,
          childPosts: [],
          imageUrls: [],
          imageAltText: [],
          imageDimensions: [],
          replyCount: null,
          postOwnerInfo: instaloaderReel.owner_username
            ? {
                username: instaloaderReel.owner_username,
                fullName: instaloaderReel.owner_full_name,
                profilePicUrl: null,
                followers: null,
                following: null,
              }
            : null,
          ownerUsername: instaloaderReel.owner_username,
          ownerFullName: instaloaderReel.owner_full_name,
        };
        sourcesReel.push('instaloader');

        // Supplement with Apify for transcript and comments when Instaloader's data is incomplete
        // (Instaloader does not provide transcript; comments may be empty without login)
        if (apifyScraper.isConfigured()) {
          try {
            const apifySupplement = await apifyScraper.scrapeReel(reelUrl);
            if (!reelData.transcript && apifySupplement.transcript) {
              reelData.transcript = apifySupplement.transcript;
              sourcesReel.push('apify-transcript');
            }
            const needsComments =
              !Array.isArray(reelData.comments) ||
              reelData.comments.length === 0 ||
              (reelData.commentCount > 0 && reelData.comments.length < Math.min(reelData.commentCount, 10));
            if (needsComments && Array.isArray(apifySupplement.comments) && apifySupplement.comments.length > 0) {
              reelData.comments = apifySupplement.comments.slice(0, 300);
              if (!sourcesReel.includes('apify-comments-scraper')) {
                sourcesReel.push('apify-comments-scraper');
              }
            }
            // Merge duration if Apify has it and we don't
            if (reelData.duration == null && apifySupplement.duration != null) {
              reelData.duration = apifySupplement.duration;
            }
          } catch (supplementError) {
            const errMsg = supplementError instanceof Error ? supplementError.message : String(supplementError);
            logger.warn({ error: errMsg }, 'Apify supplement failed (transcript/comments)');
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.warn(
          { error: errMsg, reelUrl },
          'Instaloader ML reel scrape failed, falling back to Apify / external APIs'
        );
      }
    }

    // Fallback: Apify scrapers (existing behavior)
    if (!reelData) {
      try {
        if (apifyScraper.isConfigured() && validateInstagramReelUrl(reelUrl)) {
          const apifyReelData = await apifyScraper.scrapeReel(reelUrl);
          reelData = apifyReelData;
          sourcesReel.push(
            'apify-reel-scraper',
            'apify-post-scraper',
            'apify-instagram-scraper',
            'apify-comments-scraper'
          );
        }
      } catch (error) {
        logger.warn({ error }, 'Apify scrapers failed');
      }
    }

    // Final fallback: generic external API service (it already prefers Instaloader, then Apify)
    let reelMetadata: any = null;
    if (!reelData) {
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

      if (reelData?.ownerUsername) {
        username = reelData.ownerUsername;
      } else if (reelMetadata?.ownerUsername) {
        username = reelMetadata.ownerUsername;
      } else if (reelMetadata?.permalink) {
        const match = reelMetadata.permalink.match(/instagram\.com\/([^\/]+)\/reel\//);
        if (match && match[1] !== 'reel') {
          username = match[1];
        }
      }

      if (username) {
        // Primary: Instaloader via ML service
        if (instaloaderMl.isConfigured()) {
          try {
            const profile = await instaloaderMl.fetchProfile(username);
            creatorProfile = {
              username: profile.username,
              followers: profile.followers_count,
              verified: profile.is_verified,
              bio: profile.biography,
              accountType: profile.is_verified ? 'CREATOR' : 'PERSONAL',
              following: profile.following_count,
              mediaCount: profile.posts_count,
              profilePictureUrl: profile.profile_picture_url,
              website: profile.external_url,
              profileId: profile.profile_id,
              location: null,
              joinDate: null,
              videoCount: null,
              highlightReelsCount: null,
              businessCategory: profile.business_category,
              relatedProfiles: [],
              latestPosts: profile.latest_posts?.map((post) => ({
                id: post.id,
                url: post.url,
                caption: post.caption,
                likes: post.likes,
                comments: post.comments,
                timestamp: new Date(post.timestamp),
                type: post.type,
              })),
              igtvVideoCount: null,
              usernameChangeCount: null,
              isRecentlyJoined: null,
              verifiedDate: null,
              facebookId: null,
            };
            creatorSource = 'instaloader-profile';
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.warn(
              { error: errMsg, username },
              'Instaloader ML profile fetch failed, falling back to Apify profile scraper'
            );
          }
        }

        // Fallback: Apify profile scraper
        if (!creatorProfile && apifyScraper.isConfigured()) {
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
      }
    } catch (error) {
      logger.warn({ error }, 'Creator profile fetch failed');
    }

    const metadata = reelData
      ? {
          caption: reelData.caption,
          transcript: reelData.transcript,
          likes: reelData.likeCount,
          commentCount: reelData.commentCount,
          views: reelData.playCount,
          shares: reelData.shareCount,
          timestamp: reelData.timestamp,
          duration: reelData.duration,
          hashtags: reelData.hashtags,
          mentions: reelData.mentions,
          taggedUsers: reelData.taggedUsers,
          videoUrl: reelData.videoUrl,
          thumbnailUrl: reelData.thumbnailUrl,
          musicInfo: reelData.musicInfo,
          isSponsored: reelData.isSponsored,
          commentsDisabled: reelData.commentsDisabled,
          coAuthors: reelData.coAuthors,
          mediaDimensions: reelData.mediaDimensions,

          comments:
            Array.isArray(reelData.comments) && reelData.comments.length > 0
              ? reelData.comments.slice(0, 300)
              : [],

          postType: reelData.postType,
          isPinned: reelData.isPinned,
          isPaidPartnership: reelData.isPaidPartnership,
          childPosts: reelData.childPosts,
          imageUrls: reelData.imageUrls,
          imageAltText: reelData.imageAltText,
          imageDimensions: reelData.imageDimensions,
          replyCount: reelData.replyCount,
          postOwnerInfo: reelData.postOwnerInfo,
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
          reel: reelData ? sourcesReel : [],
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
