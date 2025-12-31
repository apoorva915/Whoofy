#!/usr/bin/env python3
"""
CLIP Visual Similarity Script
Uses OpenAI CLIP to compute visual similarity between a reference product image and video frames
"""
import json
import sys
import os
from pathlib import Path

# Suppress warnings
import warnings
warnings.filterwarnings('ignore')

try:
    import torch
    import clip
    from PIL import Image
except ImportError:
    print(json.dumps({"error": "CLIP dependencies not installed. Run: pip install torch torchvision pillow ftfy"}))
    sys.exit(1)


def load_clip_model():
    """
    Load CLIP model (ViT-B/32)
    Returns model and preprocess function
    """
    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model, preprocess = clip.load("ViT-B/32", device=device)
        model.eval()
        return model, preprocess, device
    except Exception as e:
        return {"error": f"Failed to load CLIP model: {str(e)}"}


# Global model cache
_model_cache = None
_preprocess_cache = None
_device_cache = None


def get_model():
    """Get or load CLIP model (cached)"""
    global _model_cache, _preprocess_cache, _device_cache
    
    if _model_cache is None:
        result = load_clip_model()
        if isinstance(result, dict) and "error" in result:
            return result
        _model_cache, _preprocess_cache, _device_cache = result
    
    return _model_cache, _preprocess_cache, _device_cache


def embed_image(image_path: str):
    """
    Generate CLIP embedding for an image
    
    Args:
        image_path: Path to the image file
    
    Returns:
        Image embedding tensor or error dict
    """
    try:
        model, preprocess, device = get_model()
        
        if isinstance(model, dict):
            return model  # Return error
        
        # Load and preprocess image
        image = Image.open(image_path).convert('RGB')
        image_tensor = preprocess(image).unsqueeze(0).to(device)
        
        # Generate embedding
        with torch.no_grad():
            embedding = model.encode_image(image_tensor)
            # Normalize embedding for cosine similarity
            embedding = embedding / embedding.norm(dim=-1, keepdim=True)
        
        return embedding.cpu().float()
    except Exception as e:
        return {"error": f"Failed to embed image: {str(e)}"}


def compute_similarity(reference_image_path: str, frame_image_path: str):
    """
    Compute cosine similarity between reference image and frame
    
    Args:
        reference_image_path: Path to reference product image
        frame_image_path: Path to video frame image
    
    Returns:
        Similarity score (0-1) or error dict
    """
    try:
        # Generate embeddings
        ref_embedding = embed_image(reference_image_path)
        frame_embedding = embed_image(frame_image_path)
        
        if isinstance(ref_embedding, dict) and "error" in ref_embedding:
            return ref_embedding
        if isinstance(frame_embedding, dict) and "error" in frame_embedding:
            return frame_embedding
        
        # Compute cosine similarity
        similarity = torch.cosine_similarity(ref_embedding, frame_embedding).item()
        
        # Clamp to [0, 1] range (though cosine similarity is already in [-1, 1])
        # For product matching, we're interested in positive similarity
        similarity = max(0.0, similarity)
        
        return {
            "similarity": float(similarity),
            "match": similarity >= 0.30,  # Threshold for weak match
            "confidence": "high" if similarity >= 0.45 else "medium" if similarity >= 0.35 else "low" if similarity >= 0.30 else "none"
        }
    except Exception as e:
        return {"error": f"Failed to compute similarity: {str(e)}"}


def embed_reference(reference_image_path: str):
    """
    Generate and return reference image embedding (for batch processing)
    
    Args:
        reference_image_path: Path to reference product image
    
    Returns:
        Embedding tensor serialized as list or error dict
    """
    try:
        embedding = embed_image(reference_image_path)
        
        if isinstance(embedding, dict) and "error" in embedding:
            return embedding
        
        # Convert tensor to list for JSON serialization
        embedding_list = embedding.squeeze(0).tolist()
        
        return {
            "embedding": embedding_list,
            "dimension": len(embedding_list)
        }
    except Exception as e:
        return {"error": f"Failed to embed reference image: {str(e)}"}


def compare_with_embedding(frame_image_path: str, reference_embedding_list: list):
    """
    Compare frame with pre-computed reference embedding
    
    Args:
        frame_image_path: Path to video frame image
        reference_embedding_list: Pre-computed reference embedding as list
    
    Returns:
        Similarity score (0-1) or error dict
    """
    try:
        model, preprocess, device = get_model()
        
        if isinstance(model, dict):
            return model  # Return error
        
        # Convert reference embedding back to tensor
        ref_embedding = torch.tensor(reference_embedding_list, dtype=torch.float32).unsqueeze(0)
        
        # Generate frame embedding
        frame_embedding = embed_image(frame_image_path)
        
        if isinstance(frame_embedding, dict) and "error" in frame_embedding:
            return frame_embedding
        
        # Compute cosine similarity
        similarity = torch.cosine_similarity(ref_embedding, frame_embedding).item()
        similarity = max(0.0, similarity)
        
        return {
            "similarity": float(similarity),
            "match": similarity >= 0.30,
            "confidence": "high" if similarity >= 0.45 else "medium" if similarity >= 0.35 else "low" if similarity >= 0.30 else "none"
        }
    except Exception as e:
        return {"error": f"Failed to compare with embedding: {str(e)}"}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python clip_similarity.py <command> [args...]"}))
        print(json.dumps({"error": "Commands: embed <image_path> | similarity <ref_path> <frame_path> | compare <frame_path> <embedding_json>"}))
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "embed":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Usage: python clip_similarity.py embed <image_path>"}))
            sys.exit(1)
        
        image_path = sys.argv[2]
        if not os.path.exists(image_path):
            print(json.dumps({"error": f"Image file not found: {image_path}"}))
            sys.exit(1)
        
        result = embed_reference(image_path)
        print(json.dumps(result))
        
    elif command == "similarity":
        if len(sys.argv) < 4:
            print(json.dumps({"error": "Usage: python clip_similarity.py similarity <reference_image_path> <frame_image_path>"}))
            sys.exit(1)
        
        ref_path = sys.argv[2]
        frame_path = sys.argv[3]
        
        if not os.path.exists(ref_path):
            print(json.dumps({"error": f"Reference image not found: {ref_path}"}))
            sys.exit(1)
        if not os.path.exists(frame_path):
            print(json.dumps({"error": f"Frame image not found: {frame_path}"}))
            sys.exit(1)
        
        result = compute_similarity(ref_path, frame_path)
        print(json.dumps(result))
        
    elif command == "compare":
        if len(sys.argv) < 4:
            print(json.dumps({"error": "Usage: python clip_similarity.py compare <frame_image_path> <embedding_json_file>"}))
            sys.exit(1)
        
        frame_path = sys.argv[2]
        embedding_file = sys.argv[3]
        
        if not os.path.exists(frame_path):
            print(json.dumps({"error": f"Frame image not found: {frame_path}"}))
            sys.exit(1)
        if not os.path.exists(embedding_file):
            print(json.dumps({"error": f"Embedding file not found: {embedding_file}"}))
            sys.exit(1)
        
        # Load embedding from JSON file
        with open(embedding_file, 'r') as f:
            embedding_data = json.load(f)
        
        if "embedding" not in embedding_data:
            print(json.dumps({"error": "Invalid embedding file format"}))
            sys.exit(1)
        
        result = compare_with_embedding(frame_path, embedding_data["embedding"])
        print(json.dumps(result))
        
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))
        sys.exit(1)

