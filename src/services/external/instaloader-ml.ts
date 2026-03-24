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
  const root = normalizeInstaloaderApiBaseUrl(baseUrl);
  const url = `${root}/download/post`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ shortcode, target_dir: './downloads' }),
  });
  if (!res.ok) {
    logger.warn({ url, status: res.status }, 'Instaloader REST /download/post failed');
    return [];
  }
  const data = (await res.json()) as Record<string, unknown>;
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
    const reel = await this.postJson<InstaloaderReel>('/instagram/reel', { reel_url: reelUrl });
    if (reel.comments?.length) return reel;
    const restBase = env.INSTALOADER_API_BASE_URL?.trim();
    if (!restBase || !reel.shortcode) return reel;
    try {
      const fromRest = await fetchCommentsFromInstaloaderRest(reel.shortcode, restBase);
      if (fromRest.length) {
        logger.info({ count: fromRest.length, shortcode: reel.shortcode }, 'Comments from Instaloader REST API (Node fallback)');
        return { ...reel, comments: fromRest };
      }
    } catch (e) {
      logger.warn({ e, shortcode: reel.shortcode }, 'Instaloader REST comment fallback failed');
    }
    return reel;
  }

  async fetchProfile(username: string): Promise<InstaloaderProfile> {
    logger.info({ username }, 'Calling ML Instaloader profile endpoint');
    return await this.postJson<InstaloaderProfile>('/instagram/profile', { username });
  }
}

export const instaloaderMl = new InstaloaderMlClient();

