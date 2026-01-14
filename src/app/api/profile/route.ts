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

    const reelUrl = body.reelUrl as string;

    // Validate URL format
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

    // Try Apify scrapers first (most comprehensive - uses Reel Scraper + Post Scraper + Instagram Scraper + Comments Scraper)
    let apifyReelData = null;
    let apifySources: string[] = [];
    try {
      if (apifyScraper.isConfigured() && validateInstagramReelUrl(reelUrl)) {
        logger.info('Using Apify scrapers (Reel Scraper + Post Scraper + Instagram Scraper + Comments Scraper) for comprehensive data');
        apifyReelData = await apifyScraper.scrapeReel(reelUrl);
        logger.info('Apify scrapers completed successfully');
        apifySources.push('apify-reel-scraper', 'apify-post-scraper', 'apify-instagram-scraper', 'apify-comments-scraper');
      }
    } catch (error) {
      logger.warn({ error }, 'Apify scrapers failed, trying fallback methods');
    }

    // Fallback to regular Instagram API if Apify fails
    let reelMetadata = null;
    if (!apifyReelData) {
      try {
        if (validateInstagramReelUrl(reelUrl)) {
          reelMetadata = await externalApiService.getInstagramReel(reelUrl);
        }
      } catch (error) {
        logger.warn({ error }, 'Could not fetch reel metadata');
      }
    }

    // Get creator profile (if Instagram URL)
    // Try Apify Instagram Scraper first, then fallback to regular API
    let creatorProfile = null;
    let creatorSource = 'none';
    try {
      // Try to get username from Apify data first
      let username: string | null = null;
      
      if (apifyReelData?.ownerUsername) {
        username = apifyReelData.ownerUsername;
      } else if (reelMetadata?.ownerUsername) {
        username = reelMetadata.ownerUsername;
      } else if (reelMetadata?.permalink) {
        // Extract username from permalink
        const usernameMatch = reelMetadata.permalink.match(/instagram\.com\/([^\/]+)\/reel\//);
        if (usernameMatch && usernameMatch[1] !== 'reel') {
          username = usernameMatch[1];
        }
      }
      
      if (username) {
        logger.info(`Fetching creator profile for username: ${username}`);
        
        // Try Apify scrapers first for profile (Profile Scraper + Instagram Scraper)
        if (apifyScraper.isConfigured()) {
          try {
            const apifyProfile = await apifyScraper.scrapeProfile(username);
            creatorProfile = {
              username: apifyProfile.username,
              followers: apifyProfile.followersCount,
              verified: apifyProfile.isVerified,
              bio: apifyProfile.biography,
              accountType: (apifyProfile.isBusinessAccount ? 'BUSINESS' : 'CREATOR') as const,
              following: apifyProfile.followingCount,
              mediaCount: apifyProfile.postsCount,
              profilePictureUrl: apifyProfile.profilePictureUrl,
              website: apifyProfile.externalUrl,
              // Additional fields from Profile Scraper
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
            logger.info('Creator profile fetched from Apify Profile Scraper (includes Profile Scraper + Instagram Scraper data)');
          } catch (error) {
            logger.warn({ error }, 'Apify profile scraper failed, trying Instagram API');
          }
        }
        
        // Fallback to regular Instagram API
        if (!creatorProfile) {
          creatorProfile = await externalApiService.getInstagramProfile(username);
          creatorSource = 'instagram-api';
        }
      } else {
        logger.warn('Could not extract username from reel metadata');
      }
    } catch (error) {
      logger.warn({ error }, 'Could not fetch creator profile');
    }

    // Use Apify data if available, otherwise fallback to regular metadata
    const metadata = apifyReelData ? {
      caption: apifyReelData.caption,
      transcript: apifyReelData.transcript,
      likes: apifyReelData.likeCount,
      comments: apifyReelData.commentCount,
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
      comments: apifyReelData.comments && apifyReelData.comments.length > 0 
        ? apifyReelData.comments.slice(0, 200).map((comment: any) => {
            // Ensure owner object is properly mapped (handle both camelCase and snake_case)
            const mappedComment = { ...comment };
            if (comment.owner && typeof comment.owner === 'object') {
              mappedComment.owner = {
                id: comment.owner.id,
                username: comment.owner.username,
                fullName: comment.owner.fullName || comment.owner.full_name || undefined,
                profilePicUrl: comment.owner.profilePicUrl || comment.owner.profile_pic_url || undefined,
                isVerified: comment.owner.isVerified !== undefined ? comment.owner.isVerified : (comment.owner.is_verified !== undefined ? comment.owner.is_verified : undefined),
                isPrivate: comment.owner.isPrivate !== undefined ? comment.owner.isPrivate : (comment.owner.is_private !== undefined ? comment.owner.is_private : undefined),
              };
            }
            // Map replies recursively
            if (comment.replies && Array.isArray(comment.replies)) {
              mappedComment.replies = comment.replies.map((reply: any) => {
                const mappedReply = { ...reply };
                if (reply.owner && typeof reply.owner === 'object') {
                  mappedReply.owner = {
                    id: reply.owner.id,
                    username: reply.owner.username,
                    fullName: reply.owner.fullName || reply.owner.full_name || undefined,
                    profilePicUrl: reply.owner.profilePicUrl || reply.owner.profile_pic_url || undefined,
                    isVerified: reply.owner.isVerified !== undefined ? reply.owner.isVerified : (reply.owner.is_verified !== undefined ? reply.owner.is_verified : undefined),
                    isPrivate: reply.owner.isPrivate !== undefined ? reply.owner.isPrivate : (reply.owner.is_private !== undefined ? reply.owner.is_private : undefined),
                  };
                }
                return mappedReply;
              });
            }
            return mappedComment;
          })
        : [], // Limit to 200 comments (analyzing more for better bot detection)
      // Additional fields from Post Scraper
      postType: apifyReelData.postType,
      isPinned: apifyReelData.isPinned,
      isPaidPartnership: apifyReelData.isPaidPartnership,
      childPosts: apifyReelData.childPosts,
      imageUrls: apifyReelData.imageUrls,
      imageAltText: apifyReelData.imageAltText,
      imageDimensions: apifyReelData.imageDimensions,
      replyCount: apifyReelData.replyCount,
      postOwnerInfo: apifyReelData.postOwnerInfo,
    } : (reelMetadata ? {
      caption: reelMetadata.caption,
      transcript: null,
      likes: reelMetadata.likeCount,
      comments: reelMetadata.commentCount,
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
    } : null);

    const response = {
      success: true,
      data: {
        reelUrl,
        metadata,
        creator: creatorProfile ? {
          username: creatorProfile.username,
          followers: creatorProfile.followers ?? 0,
          verified: creatorProfile.verified ?? false,
          bio: creatorProfile.bio ?? null,
          accountType: creatorProfile.accountType,
          following: creatorProfile.following ?? 0,
          mediaCount: creatorProfile.mediaCount ?? 0,
          profilePictureUrl: creatorProfile.profilePictureUrl ?? null,
          website: creatorProfile.website ?? null,
          // Additional fields from Profile Scraper
          profileId: creatorProfile.profileId ?? null,
          location: creatorProfile.location ?? null,
          joinDate: creatorProfile.joinDate ?? null,
          videoCount: creatorProfile.videoCount ?? null,
          highlightReelsCount: creatorProfile.highlightReelsCount ?? null,
          businessCategory: creatorProfile.businessCategory ?? null,
          relatedProfiles: creatorProfile.relatedProfiles ?? undefined,
          latestPosts: creatorProfile.latestPosts ?? undefined,
          igtvVideoCount: creatorProfile.igtvVideoCount ?? null,
          usernameChangeCount: creatorProfile.usernameChangeCount ?? null,
          isRecentlyJoined: creatorProfile.isRecentlyJoined ?? null,
          verifiedDate: creatorProfile.verifiedDate ?? null,
          facebookId: creatorProfile.facebookId ?? null,
        } : null,
        sources: {
          reel: apifyReelData ? apifySources : (reelMetadata ? ['instagram-api'] : []),
          creator: creatorSource !== 'none' ? [creatorSource] : [],
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack,
    }, 'Profile scraping error');
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROFILE_ERROR',
          message: error.message || 'Failed to scrape profile',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

