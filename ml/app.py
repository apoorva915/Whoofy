import os
from datetime import datetime
from typing import Any, Optional, List

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
    """
    try:
        shortcode = _extract_shortcode_from_url(req.reel_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        post = instaloader.Post.from_shortcode(_instaloader.context, shortcode)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Instaloader failed to fetch reel: {e}")

    caption = post.caption or ""

    # Extract hashtags and mentions from caption
    import re

    hashtags = [h[1:] for h in re.findall(r"#\w+", caption)]
    mentions = [m[1:] for m in re.findall(r"@\w+", caption)]

    # Basic comments (top-level only, limited for performance)
    comments: list[InstagramComment] = []
    try:
        # Limit to first 200 comments to keep response size reasonable
        for idx, c in enumerate(post.get_comments()):
            if idx >= 200:
                break
            comments.append(
                InstagramComment(
                    id=str(getattr(c, "id", "")) or None,
                    text=str(getattr(c, "text", "") or ""),
                    owner_username=str(getattr(c, "owner", None).username if getattr(c, "owner", None) else "") or "unknown",
                    timestamp=getattr(c, "created_at_utc", datetime.utcnow()),
                    likes_count=getattr(c, "likes_count", None),
                )
            )
    except Exception:
        # Comment fetching is optional; ignore failures
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

