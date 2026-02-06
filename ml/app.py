import os
from typing import Any, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

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


app = FastAPI(title="Whoofy ML Service", version="1.0.0")


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

