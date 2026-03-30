import json
import logging
import os
import re
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Optional, List, Tuple

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import instaloader

# Import existing logic (preserve behavior)
from yolo.detect import detect_objects
from yolo.ocr import read_text
from yolo.face_detection import detect_faces
from yolo.clip_similarity import embed_reference, compare_with_embedding


class HealthResponse(BaseModel):
    ok: bool = True


class ImagePathRequest(BaseModel):
    image_path: str = Field(..., description="Absolute path to image on shared volume")


class YoloRequest(ImagePathRequest):
    confidence: float = Field(0.25, ge=0.0, le=1.0)


class OcrResponse(BaseModel):
    text: str


class YoloResponse(BaseModel):
    objects: list[str]


class FacesResponse(BaseModel):
    people: list[dict[str, Any]]


class ClipEmbedResponse(BaseModel):
    embedding: list[float]
    dimension: int


class ClipEmbedRequest(ImagePathRequest):
    pass


class ClipCompareRequest(ImagePathRequest):
    embedding_path: str = Field(..., description="Path to JSON embedding created by embed")


class ClipCompareResponse(BaseModel):
    similarity: float
    match: bool
    confidence: str


class InstagramReelRequest(BaseModel):
    reel_url: str = Field(..., description="Full Instagram reel URL")


class InstagramComment(BaseModel):
    id: Optional[str] = None
    text: str
    owner_username: str
    timestamp: datetime
    likes_count: Optional[int] = None


class InstagramReelResponse(BaseModel):
    id: str
    shortcode: str
    url: str
    caption: Optional[str] = None
    like_count: int
    comment_count: int
    play_count: Optional[int] = None
    timestamp: datetime
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    owner_username: Optional[str] = None
    owner_full_name: Optional[str] = None
    hashtags: List[str] = []
    mentions: List[str] = []
    comments: List[InstagramComment] = []


class InstagramProfileRequest(BaseModel):
    username: str = Field(..., description="Instagram username (without @)")


class InstagramProfilePost(BaseModel):
    id: str
    url: str
    caption: Optional[str] = None
    likes: int
    comments: int
    timestamp: datetime
    type: str


class InstagramProfileResponse(BaseModel):
    username: str
    full_name: Optional[str] = None
    biography: Optional[str] = None
    followers_count: int
    following_count: int
    posts_count: int
    profile_picture_url: Optional[str] = None
    is_verified: bool
    is_private: bool
    external_url: Optional[str] = None
    profile_id: Optional[str] = None
    profile_url: Optional[str] = None
    business_category: Optional[str] = None
    latest_posts: List[InstagramProfilePost] = []


app = FastAPI(title="Whoofy ML Service", version="1.0.0")

logger = logging.getLogger("whoofy.ml")

COMMENT_LIMIT = 200
INSTALOADER_REST_TIMEOUT_SEC = 120


def _normalize_instaloader_api_base_url(base_url: str) -> str:
    """API root only, not /docs (Swagger). Strip trailing /docs if pasted from browser."""
    u = base_url.strip().rstrip("/")
    if u.lower().endswith("/docs"):
        u = u[:-5].rstrip("/")
    return u


def _parse_comment_timestamp(node: dict) -> datetime:
    raw = node.get("created_at") or node.get("created_at_utc") or node.get("createdAt")
    if isinstance(raw, (int, float)):
        try:
            return datetime.utcfromtimestamp(float(raw))
        except (OverflowError, OSError, ValueError):
            pass
    if isinstance(raw, str) and raw.strip():
        s = raw.strip().replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            pass
    return datetime.utcnow()


def _owner_username_from_node(node: dict) -> str:
    owner = node.get("owner")
    if isinstance(owner, dict):
        u = owner.get("username") or owner.get("user_name")
        if u:
            return str(u)
    u = node.get("owner_username") or node.get("username")
    if u:
        return str(u)
    return "unknown"


def _likes_from_node(node: dict) -> Optional[int]:
    if node.get("likes_count") is not None:
        try:
            return int(node["likes_count"])
        except (TypeError, ValueError):
            pass
    elb = node.get("edge_liked_by")
    if isinstance(elb, dict) and elb.get("count") is not None:
        try:
            return int(elb["count"])
        except (TypeError, ValueError):
            pass
    return None


def _node_to_instagram_comment(node: dict) -> Optional[InstagramComment]:
    if not isinstance(node, dict):
        return None
    text = node.get("text")
    if text is None and node.get("node") is not None:
        inner = node.get("node")
        if isinstance(inner, dict):
            return _node_to_instagram_comment(inner)
    text = str(text or "")
    cid = node.get("id")
    cid_str = str(cid) if cid is not None else None
    return InstagramComment(
        id=cid_str,
        text=text,
        owner_username=_owner_username_from_node(node),
        timestamp=_parse_comment_timestamp(node),
        likes_count=_likes_from_node(node),
    )


def _iter_comment_dicts_from_latest_payload(latest: Any) -> List[dict]:
    """Normalize latestComments from Instaloader REST /download/post (GraphQL-style or flat list)."""
    if latest is None:
        return []
    out: List[dict] = []
    if isinstance(latest, list):
        for item in latest:
            if isinstance(item, dict):
                out.append(item)
        return out
    if isinstance(latest, dict):
        edges = latest.get("edges")
        if isinstance(edges, list):
            for edge in edges:
                if isinstance(edge, dict) and isinstance(edge.get("node"), dict):
                    out.append(edge["node"])
            if out:
                return out
        comments = latest.get("comments")
        if isinstance(comments, list):
            for c in comments:
                if isinstance(c, dict):
                    out.append(c)
            if out:
                return out
        # Single wrapper object sometimes used by APIs
        for key in ("data", "nodes", "items"):
            v = latest.get(key)
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return [x for x in v if isinstance(x, dict)]
    return out


def _fetch_download_post_json(shortcode: str, base_url: str) -> Optional[dict]:
    """POST /download/post; return parsed JSON or None on failure."""
    root = _normalize_instaloader_api_base_url(base_url)
    url = f"{root}/download/post"
    payload = json.dumps({"shortcode": shortcode, "target_dir": "./downloads"}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=INSTALOADER_REST_TIMEOUT_SEC) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        logger.warning(
            "Instaloader REST API HTTP error for shortcode=%s: %s %s",
            shortcode,
            e.code,
            err_body[:500],
        )
        return None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        logger.warning("Instaloader REST API request failed for shortcode=%s: %s", shortcode, e)
        return None

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Instaloader REST API returned non-JSON for shortcode=%s", shortcode)
        return None


def _parse_instagram_rest_datetime(val: Any) -> datetime:
    if val is None:
        return datetime.utcnow()
    if isinstance(val, (int, float)):
        x = float(val)
        if x > 1e12:
            x /= 1000.0
        try:
            return datetime.utcfromtimestamp(x)
        except (OverflowError, OSError, ValueError):
            return datetime.utcnow()
    if isinstance(val, str) and val.strip():
        s = val.strip().replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            pass
    return datetime.utcnow()


def _owner_from_rest_post_body(body: dict) -> Tuple[Optional[str], Optional[str]]:
    o = body.get("owner")
    if isinstance(o, dict):
        u = o.get("username") or o.get("user_name")
        fn = o.get("full_name") or o.get("fullName")
        return (str(u) if u else None, str(fn) if fn else None)
    for ukey, fkey in (
        ("ownerUsername", "ownerFullName"),
        ("owner_username", "owner_full_name"),
    ):
        if body.get(ukey):
            fn = body.get(fkey)
            return (str(body[ukey]), str(fn) if fn else None)
    return (None, None)


def _reel_response_from_rest_payload(body: dict, reel_url: str, shortcode: str) -> InstagramReelResponse:
    """Build ML reel response from Instaloader REST /download/post JSON (when GraphQL is rate-limited)."""
    caption = (body.get("caption") or "") or ""
    hashtags = [h[1:] for h in re.findall(r"#\w+", caption)]
    mentions = [m[1:] for m in re.findall(r"@\w+", caption)]
    hs = body.get("hashtags")
    if isinstance(hs, str) and hs.strip() and not hashtags:
        hashtags = [x.strip().lstrip("#") for x in re.split(r"[\s,]+", hs) if x.strip()]
    ms = body.get("mentions")
    if isinstance(ms, str) and ms.strip() and not mentions:
        mentions = [x.strip().lstrip("@") for x in re.split(r"[\s,]+", ms) if x.strip()]

    comments = _comments_from_instaloader_rest_payload(body)
    owner_username, owner_full_name = _owner_from_rest_post_body(body)

    media_id = body.get("mediaId") or body.get("media_id") or shortcode
    sc = body.get("shortCode") or body.get("shortcode") or shortcode

    like_count = int(body.get("likeCount") or body.get("like_count") or 0)
    cc_raw = body.get("commentCount") if body.get("commentCount") is not None else body.get("comment_count")
    comment_count = int(cc_raw) if cc_raw is not None else len(comments)

    play_raw = body.get("playCount") if body.get("playCount") is not None else body.get("viewCount")
    if play_raw is None:
        play_raw = body.get("play_count") or body.get("view_count")
    play_count: Optional[int] = None
    if play_raw is not None:
        try:
            play_count = int(play_raw)
        except (TypeError, ValueError):
            pass

    media_type = str(body.get("mediaType") or body.get("media_type") or "").lower()
    product_type = str(body.get("productType") or body.get("product_type") or "").lower()
    media_url = body.get("mediaUrl") or body.get("media_url")
    video_url = body.get("videoDownloadUrl") or body.get("video_download_url")
    if not video_url and media_url and ("video" in media_type or product_type in ("clips", "feed", "igtv")):
        video_url = media_url
    thumbnail_url = body.get("thumbnailUrl") or body.get("thumbnail_url")

    ts = _parse_instagram_rest_datetime(body.get("createdAt") or body.get("created_at"))

    return InstagramReelResponse(
        id=str(media_id),
        shortcode=str(sc),
        url=reel_url,
        caption=caption or None,
        like_count=like_count,
        comment_count=comment_count,
        play_count=play_count,
        timestamp=ts,
        video_url=video_url,
        thumbnail_url=thumbnail_url,
        owner_username=owner_username,
        owner_full_name=owner_full_name,
        hashtags=hashtags,
        mentions=mentions,
        comments=comments,
    )


def _comments_from_instaloader_rest_payload(body: dict) -> List[InstagramComment]:
    latest = body.get("latestComments")
    raw_nodes = _iter_comment_dicts_from_latest_payload(latest)
    if not raw_nodes:
        raw_nodes = _iter_comment_dicts_from_latest_payload(body.get("comments"))
    result: List[InstagramComment] = []
    for node in raw_nodes[:COMMENT_LIMIT]:
        c = _node_to_instagram_comment(node)
        if c:
            result.append(c)
    return result


def _fetch_comments_from_instaloader_rest_api(shortcode: str, base_url: str) -> List[InstagramComment]:
    """
    Primary comment source: hosted Instaloader REST API (POST /download/post).
    See https://instaloader.github.io/ — same backend as CLI; REST often works when direct GraphQL is blocked.
    """
    data = _fetch_download_post_json(shortcode, base_url)
    if not data:
        return []
    return _comments_from_instaloader_rest_payload(data)


def _extract_shortcode_from_url(reel_url: str) -> str:
    """
    Extract reel shortcode from a full Instagram reel URL.
    """
    try:
        # Normalize URL
        if not reel_url.startswith("http://") and not reel_url.startswith("https://"):
            reel_url = f"https://{reel_url}"
        from urllib.parse import urlparse

        parsed = urlparse(reel_url)
        path = parsed.path.strip("/")
        parts = path.split("/")
        # Expected patterns:
        # /reel/{shortcode}/
        # /p/{shortcode}/
        if len(parts) >= 2 and parts[0] in {"reel", "p"}:
            return parts[1]
        # Fallback: last non-empty segment
        for segment in reversed(parts):
            if segment:
                return segment
    except Exception:
        pass
    raise ValueError(f"Could not extract reel shortcode from URL: {reel_url}")


def _build_instaloader_instance() -> instaloader.Instaloader:
    """
    Create and configure a shared Instaloader instance optimized for metadata-only usage.
    """
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        save_metadata=False,
        compress_json=False,
        download_comments=True,
        quiet=True,
    )

    username = os.getenv("INSTALOADER_USERNAME")
    password = os.getenv("INSTALOADER_PASSWORD")

    if username and password:
        try:
            L.login(username, password)
        except Exception:
            # Login is optional; continue unauthenticated on failure
            pass

    return L


_instaloader = _build_instaloader_instance()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(ok=True)


@app.post("/ocr", response_model=OcrResponse)
def ocr(req: ImagePathRequest) -> OcrResponse:
    if not os.path.exists(req.image_path):
        raise ValueError(f"Image file not found: {req.image_path}")
    result = read_text(req.image_path)
    if isinstance(result, dict) and "error" in result:
        raise ValueError(result["error"])
    return OcrResponse(text=str(result or ""))


@app.post("/yolo", response_model=YoloResponse)
def yolo(req: YoloRequest) -> YoloResponse:
    if not os.path.exists(req.image_path):
        raise ValueError(f"Image file not found: {req.image_path}")
    result = detect_objects(req.image_path, req.confidence)
    if isinstance(result, dict) and "error" in result:
        raise ValueError(result["error"])
    return YoloResponse(objects=list(result or []))


@app.post("/faces", response_model=FacesResponse)
def faces(req: ImagePathRequest) -> FacesResponse:
    if not os.path.exists(req.image_path):
        raise ValueError(f"Image file not found: {req.image_path}")
    # Existing function returns a JSON string
    raw = detect_faces(req.image_path)
    try:
        import json

        parsed = json.loads(raw)
    except Exception as e:
        raise ValueError(f"Failed to parse face detection output: {e}")

    if isinstance(parsed, dict) and "error" in parsed:
        raise ValueError(parsed["error"])

    people = parsed.get("people", []) if isinstance(parsed, dict) else []
    return FacesResponse(people=people)


@app.post("/clip/embed", response_model=ClipEmbedResponse)
def clip_embed(req: ClipEmbedRequest) -> ClipEmbedResponse:
    if not os.path.exists(req.image_path):
        raise ValueError(f"Image file not found: {req.image_path}")
    result = embed_reference(req.image_path)
    if isinstance(result, dict) and "error" in result:
        raise ValueError(result["error"])
    return ClipEmbedResponse(embedding=result["embedding"], dimension=result["dimension"])


@app.post("/clip/compare", response_model=ClipCompareResponse)
def clip_compare(req: ClipCompareRequest) -> ClipCompareResponse:
    if not os.path.exists(req.image_path):
        raise ValueError(f"Image file not found: {req.image_path}")
    if not os.path.exists(req.embedding_path):
        raise ValueError(f"Embedding file not found: {req.embedding_path}")

    import json

    with open(req.embedding_path, "r", encoding="utf-8") as f:
        embedding_data = json.load(f)

    if "embedding" not in embedding_data:
        raise ValueError("Invalid embedding file format")

    result = compare_with_embedding(req.image_path, embedding_data["embedding"])
    if isinstance(result, dict) and "error" in result:
        raise ValueError(result["error"])
    return ClipCompareResponse(
        similarity=float(result["similarity"]),
        match=bool(result["match"]),
        confidence=str(result["confidence"]),
    )


@app.post("/instagram/reel", response_model=InstagramReelResponse)
def instagram_reel(req: InstagramReelRequest) -> InstagramReelResponse:
    """
    Fetch reel metadata using Instaloader.
    This is used as the primary Instagram scraping backend (with Apify as fallback in the Node app).

    When direct GraphQL is rate-limited (401 / "wait a few minutes"), we fall back to the hosted
    Instaloader REST API (INSTALOADER_API_BASE_URL + POST /download/post) so the server IP is not
    the only path to Instagram.
    """
    try:
        shortcode = _extract_shortcode_from_url(req.reel_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rest_base = (os.getenv("INSTALOADER_API_BASE_URL") or "").strip()

    try:
        post = instaloader.Post.from_shortcode(_instaloader.context, shortcode)
    except Exception as e:
        logger.warning(
            "Instaloader GraphQL failed for shortcode=%s (often rate limit): %s",
            shortcode,
            e,
        )
        if rest_base:
            rest_data = _fetch_download_post_json(shortcode, rest_base)
            if rest_data:
                logger.info(
                    "Using Instaloader REST /download/post for full reel metadata (shortcode=%s)",
                    shortcode,
                )
                return _reel_response_from_rest_payload(rest_data, req.reel_url, shortcode)
        raise HTTPException(status_code=502, detail=f"Instaloader failed to fetch reel: {e}")

    caption = post.caption or ""

    # Extract hashtags and mentions from caption
    hashtags = [h[1:] for h in re.findall(r"#\w+", caption)]
    mentions = [m[1:] for m in re.findall(r"@\w+", caption)]

    # Comments: (1) Instaloader REST API if INSTALOADER_API_BASE_URL is set — avoids hammering GraphQL;
    # (2) local instaloader Post.get_comments(); Apify fallback is in the Node app.
    comments: list[InstagramComment] = []
    if rest_base:
        comments = _fetch_comments_from_instaloader_rest_api(shortcode, rest_base)
        if comments:
            logger.info(
                "Using %d comments from Instaloader REST API for shortcode=%s",
                len(comments),
                shortcode,
            )
    if not comments:
        try:
            for idx, c in enumerate(post.get_comments()):
                if idx >= COMMENT_LIMIT:
                    break
                comments.append(
                    InstagramComment(
                        id=str(getattr(c, "id", "")) or None,
                        text=str(getattr(c, "text", "") or ""),
                        owner_username=str(getattr(c, "owner", None).username if getattr(c, "owner", None) else "")
                        or "unknown",
                        timestamp=getattr(c, "created_at_utc", datetime.utcnow()),
                        likes_count=getattr(c, "likes_count", None),
                    )
                )
        except Exception as e:
            logger.debug("Local instaloader get_comments failed for shortcode=%s: %s", shortcode, e)
            comments = []

    owner_username: Optional[str] = None
    owner_full_name: Optional[str] = None
    try:
        owner_username = post.owner_username
        owner_profile = post.owner_profile
        owner_full_name = getattr(owner_profile, "full_name", None)
    except Exception:
        pass

    return InstagramReelResponse(
        id=str(post.mediaid) if getattr(post, "mediaid", None) is not None else post.shortcode,
        shortcode=post.shortcode,
        url=req.reel_url,
        caption=caption or None,
        like_count=int(getattr(post, "likes", 0)),
        comment_count=int(getattr(post, "comments", 0)),
        play_count=int(getattr(post, "video_view_count", 0)) if getattr(post, "is_video", False) else None,
        timestamp=post.date_utc,
        video_url=getattr(post, "video_url", None),
        thumbnail_url=getattr(post, "url", None),
        owner_username=owner_username,
        owner_full_name=owner_full_name,
        hashtags=hashtags,
        mentions=mentions,
        comments=comments,
    )


@app.post("/instagram/profile", response_model=InstagramProfileResponse)
def instagram_profile(req: InstagramProfileRequest) -> InstagramProfileResponse:
    """
    Fetch profile metadata using Instaloader.
    This is used as the primary Instagram profile backend (with Apify as fallback in the Node app).
    """
    username = req.username.lstrip("@").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    try:
        profile = instaloader.Profile.from_username(_instaloader.context, username)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Instaloader failed to fetch profile: {e}")

    # Latest posts (limit for performance)
    latest_posts: list[InstagramProfilePost] = []
    try:
        for idx, post in enumerate(profile.get_posts()):
            if idx >= 12:
                break
            latest_posts.append(
                InstagramProfilePost(
                    id=str(getattr(post, "mediaid", None) or post.shortcode),
                    url=f"https://www.instagram.com/p/{post.shortcode}/",
                    caption=getattr(post, "caption", None),
                    likes=int(getattr(post, "likes", 0)),
                    comments=int(getattr(post, "comments", 0)),
                    timestamp=post.date_utc,
                    type="video" if getattr(post, "is_video", False) else "image",
                )
            )
    except Exception:
        latest_posts = []

    profile_url = f"https://www.instagram.com/{profile.username}/"

    return InstagramProfileResponse(
        username=profile.username,
        full_name=profile.full_name or None,
        biography=profile.biography or None,
        followers_count=int(profile.followers),
        following_count=int(profile.followees),
        posts_count=int(profile.mediacount),
        profile_picture_url=str(profile.profile_pic_url) if getattr(profile, "profile_pic_url", None) else None,
        is_verified=bool(getattr(profile, "is_verified", False)),
        is_private=bool(getattr(profile, "is_private", False)),
        external_url=profile.external_url or None,
        profile_id=str(profile.userid) if getattr(profile, "userid", None) is not None else None,
        profile_url=profile_url,
        business_category=getattr(profile, "business_category_name", None),
        latest_posts=latest_posts,
    )

