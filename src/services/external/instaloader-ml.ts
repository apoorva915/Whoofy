import env from '@/config/env';
import logger from '@/utils/logger';

const COMMENT_LIMIT = 200;

/** API root only — not the Swagger page (/docs). Accepts either and normalizes. */
function normalizeInstaloaderApiBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '');
  if (/\/docs$/i.test(u)) {
    u = u.replace(/\/docs$/i, '').replace(/\/+$/, '');
  }
  return u;
}

interface InstaloaderComment {
  id?: string;
  text: string;
  owner_username: string;
  timestamp: string;
  likes_count?: number;
}

export interface InstaloaderReel {
  id: string;
  shortcode: string;
  url: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  play_count: number | null;
  timestamp: string;
  video_url: string | null;
  thumbnail_url: string | null;
  owner_username: string | null;
  owner_full_name: string | null;
  hashtags: string[];
  mentions: string[];
  comments: InstaloaderComment[];
}

interface InstaloaderProfilePost {
  id: string;
  url: string;
  caption: string | null;
  likes: number;
  comments: number;
  timestamp: string;
  type: string;
}

export interface InstaloaderProfile {
  username: string;
  full_name: string | null;
  biography: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  profile_picture_url: string | null;
  is_verified: boolean;
  is_private: boolean;
  external_url: string | null;
  profile_id: string | null;
  profile_url: string | null;
  business_category: string | null;
  latest_posts: InstaloaderProfilePost[];
}

function parseCommentNodes(nodes: unknown[]): InstaloaderComment[] {
  const out: InstaloaderComment[] = [];
  for (const raw of nodes.slice(0, COMMENT_LIMIT)) {
    if (!raw || typeof raw !== 'object') continue;
    const node = raw as Record<string, unknown>;
    const inner =
      node.node && typeof node.node === 'object' ? (node.node as Record<string, unknown>) : node;
    const text = inner.text != null ? String(inner.text) : '';
    const id =
      inner.id != null ? String(inner.id) : node.id != null ? String(node.id) : undefined;
    const owner = inner.owner && typeof inner.owner === 'object' ? (inner.owner as Record<string, unknown>) : null;
    const owner_username =
      (owner?.username != null ? String(owner.username) : null) ||
      (inner.owner_username != null ? String(inner.owner_username) : null) ||
      (inner.username != null ? String(inner.username) : null) ||
      'unknown';
    let ts: string;
    const rawTs = inner.created_at ?? inner.created_at_utc ?? inner.createdAt;
    if (typeof rawTs === 'number') {
      ts = new Date(rawTs * (rawTs < 1e12 ? 1000 : 1)).toISOString();
    } else if (typeof rawTs === 'string' && rawTs.trim()) {
      const d = new Date(rawTs);
      ts = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } else {
      ts = new Date().toISOString();
    }
    const likesRaw = inner.likes_count ?? inner.like_count;
    const likes_count =
      likesRaw != null && typeof likesRaw === 'number'
        ? likesRaw
        : likesRaw != null
          ? Number(likesRaw)
          : undefined;
    out.push({
      id,
      text,
      owner_username,
      timestamp: ts,
      likes_count: Number.isFinite(likes_count as number) ? (likes_count as number) : undefined,
    });
  }
  return out;
}

function extractShortcodeFromReelUrl(reelUrl: string): string | null {
  try {
    const u = new URL(
      reelUrl.startsWith('http://') || reelUrl.startsWith('https://') ? reelUrl : `https://${reelUrl}`
    );
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'reel' || parts[0] === 'p')) return parts[1];
    return parts.length ? parts[parts.length - 1] : null;
  } catch {
    return null;
  }
}

function mapDownloadPostJsonToReel(
  reelUrl: string,
  fallbackShortcode: string,
  data: Record<string, unknown>
): InstaloaderReel {
  const captionRaw = data.caption != null ? String(data.caption) : '';
  const caption = captionRaw || null;
  const hashtags = captionRaw ? Array.from(captionRaw.matchAll(/#\w+/g), (m) => m[0].slice(1)) : [];
  const mentions = captionRaw ? Array.from(captionRaw.matchAll(/@\w+/g), (m) => m[0].slice(1)) : [];

  let owner_username: string | null = null;
  let owner_full_name: string | null = null;
  const o = data.owner;
  if (o && typeof o === 'object') {
    const od = o as Record<string, unknown>;
    if (od.username != null) owner_username = String(od.username);
    if (od.full_name != null) owner_full_name = String(od.full_name);
    if (od.fullName != null) owner_full_name = String(od.fullName);
  }
  if (!owner_username && data.ownerUsername != null) owner_username = String(data.ownerUsername);
  if (!owner_full_name && data.ownerFullName != null) owner_full_name = String(data.ownerFullName);

  const mediaId = data.mediaId != null ? String(data.mediaId) : fallbackShortcode;
  const sc = data.shortCode != null ? String(data.shortCode) : fallbackShortcode;

  const like_count = Number(data.likeCount ?? data.like_count ?? 0) || 0;
  let commentNodes = latestCommentsToNodes(data.latestComments);
  if (!commentNodes.length) commentNodes = latestCommentsToNodes(data.comments);
  const comments = parseCommentNodes(commentNodes);
  const ccRaw = data.commentCount ?? data.comment_count;
  const comment_count =
    ccRaw != null && !Number.isNaN(Number(ccRaw)) ? Number(ccRaw) : comments.length;

  let play_count: number | null = null;
  const pr = data.playCount ?? data.viewCount ?? data.play_count ?? data.view_count;
  if (pr != null) {
    const n = Number(pr);
    if (!Number.isNaN(n)) play_count = n;
  }

  const mediaType = String(data.mediaType ?? data.media_type ?? '').toLowerCase();
  const productType = String(data.productType ?? data.product_type ?? '').toLowerCase();
  const mediaUrl = data.mediaUrl ?? data.media_url;
  let video_url: string | null =
    data.videoDownloadUrl != null || data.video_download_url != null
      ? String(data.videoDownloadUrl ?? data.video_download_url)
      : null;
  if (!video_url && typeof mediaUrl === 'string' && (mediaType.includes('video') || productType === 'clips')) {
    video_url = mediaUrl;
  }

  const thumb = data.thumbnailUrl ?? data.thumbnail_url;
  const thumbnail_url = thumb != null ? String(thumb) : null;

  const created = data.createdAt ?? data.created_at;
  let timestamp: string;
  if (typeof created === 'number') {
    timestamp = new Date(created > 1e12 ? created : created * 1000).toISOString();
  } else if (typeof created === 'string' && created.trim()) {
    const d = new Date(created);
    timestamp = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } else {
    timestamp = new Date().toISOString();
  }

  return {
    id: mediaId,
    shortcode: sc,
    url: reelUrl,
    caption,
    like_count,
    comment_count,
    play_count,
    timestamp,
    video_url,
    thumbnail_url,
    owner_username,
    owner_full_name,
    hashtags,
    mentions,
    comments,
  };
}

async function fetchInstaloaderDownloadPost(
  shortcode: string,
  baseUrl: string
): Promise<Record<string, unknown> | null> {
  const root = normalizeInstaloaderApiBaseUrl(baseUrl);
  const url = `${root}/download/post`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ shortcode, target_dir: './downloads' }),
  });
  if (!res.ok) {
    logger.warn({ url, status: res.status }, 'Instaloader REST /download/post failed');
    return null;
  }
  return (await res.json()) as Record<string, unknown>;
}

function latestCommentsToNodes(latest: unknown): unknown[] {
  if (latest == null) return [];
  if (Array.isArray(latest)) return latest;
  if (typeof latest === 'object') {
    const o = latest as Record<string, unknown>;
    const edges = o.edges;
    if (Array.isArray(edges)) {
      return edges.map((e) => (e && typeof e === 'object' && 'node' in e ? (e as { node: unknown }).node : e));
    }
    const comments = o.comments;
    if (Array.isArray(comments)) return comments;
    for (const key of ['data', 'nodes', 'items'] as const) {
      const v = o[key];
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
    }
  }
  return [];
}

async function fetchCommentsFromInstaloaderRest(shortcode: string, baseUrl: string): Promise<InstaloaderComment[]> {
  const data = await fetchInstaloaderDownloadPost(shortcode, baseUrl);
  if (!data) return [];
  let nodes = latestCommentsToNodes(data.latestComments);
  if (!nodes.length) nodes = latestCommentsToNodes(data.comments);
  return parseCommentNodes(nodes);
}

class InstaloaderMlClient {
  private baseUrl?: string;

  constructor() {
    this.baseUrl = env.ML_SERVICE_URL?.replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  private async postJson<TResponse>(endpoint: string, body: Record<string, any>): Promise<TResponse> {
    if (!this.baseUrl) {
      throw new Error('ML service URL (ML_SERVICE_URL) is not configured');
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      logger.error({ url, status: res.status, textPreview: text.slice(0, 300) }, 'Instaloader ML service returned non-JSON response');
      throw new Error(`Instaloader ML service returned non-JSON response (${res.status})`);
    }

    if (!res.ok) {
      const message = parsed?.detail || parsed?.error || `Instaloader ML service error (${res.status})`;
      throw new Error(message);
    }

    if (parsed?.error) {
      throw new Error(parsed.error);
    }

    return parsed as TResponse;
  }

  async fetchReel(reelUrl: string): Promise<InstaloaderReel> {
    logger.info({ reelUrl }, 'Calling ML Instaloader reel endpoint');
    const restBase = env.INSTALOADER_API_BASE_URL?.trim();
    const shortcode = extractShortcodeFromReelUrl(reelUrl);

    try {
      const reel = await this.postJson<InstaloaderReel>('/instagram/reel', { reel_url: reelUrl });
      if (reel.comments?.length) return reel;
      if (!restBase || !reel.shortcode) return reel;
      try {
        const fromRest = await fetchCommentsFromInstaloaderRest(reel.shortcode, restBase);
        if (fromRest.length) {
          logger.info(
            { count: fromRest.length, shortcode: reel.shortcode },
            'Comments from Instaloader REST API (Node fallback)'
          );
          return { ...reel, comments: fromRest };
        }
      } catch (e) {
        logger.warn({ e, shortcode: reel.shortcode }, 'Instaloader REST comment fallback failed');
      }
      return reel;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const graphqlLikelyFailed =
        /401|Unauthorized|wait a few minutes|Instaloader failed|failed to fetch reel|502/i.test(msg);
      if (!restBase || !graphqlLikelyFailed || !shortcode) throw err;
      const data = await fetchInstaloaderDownloadPost(shortcode, restBase);
      if (!data) throw err;
      const reel = mapDownloadPostJsonToReel(reelUrl, shortcode, data);
      logger.info(
        { shortcode },
        'Full reel from Instaloader REST API (ML GraphQL rate-limited or unavailable)'
      );
      return reel;
    }
  }

  async fetchProfile(username: string): Promise<InstaloaderProfile> {
    logger.info({ username }, 'Calling ML Instaloader profile endpoint');
    return await this.postJson<InstaloaderProfile>('/instagram/profile', { username });
  }
}

export const instaloaderMl = new InstaloaderMlClient();

