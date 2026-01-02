# CLIP Visual Similarity Setup

This directory contains the CLIP-based visual similarity matching system for product detection.

## Overview

CLIP (Contrastive Language-Image Pre-Training) is used to compute visual similarity between a reference product image and video frames. This complements OCR and YOLO detection by providing visual matching even when:
- OCR fails to read text
- Product packaging has no visible text
- Frames are blurry or low quality
- Different lighting conditions
- Variant packaging designs

## Installation

### 1. Install CLIP Dependencies

```bash
pip install -r requirements_clip.txt
```

Or install manually:
```bash
pip install torch torchvision pillow ftfy
pip install git+https://github.com/openai/CLIP.git
```

### 2. Verify Installation

```bash
python yolo/clip_similarity.py embed test_image.jpg
```

## Usage

### Generate Reference Embedding

```bash
python yolo/clip_similarity.py embed <reference_image_path>
```

Output: JSON with embedding array and dimension

### Compute Similarity

```bash
python yolo/clip_similarity.py similarity <reference_image_path> <frame_image_path>
```

Output: JSON with similarity score, match boolean, and confidence level

### Compare with Pre-computed Embedding

```bash
python yolo/clip_similarity.py compare <frame_image_path> <embedding_json_file>
```

## Similarity Thresholds

| Similarity Score | Meaning | Confidence | Context Required |
|-----------------|---------|------------|-----------------|
| ≥ 0.50 | Very confident match | high | None (accepted automatically) |
| 0.45-0.50 | Likely product match | medium | Product objects OR brand text |
| 0.40-0.45 | Possible match | medium | Product objects OR brand text |
| < 0.40 | No match | none | N/A (rejected) |

**Note:** Medium similarity matches (0.40-0.50) require contextual evidence (product-related objects like "bottle", "box" OR detected brand text) to reduce false positives. High similarity (≥0.50) is accepted without context.

## Integration

The system automatically:
1. Generates reference embedding when product image is uploaded
2. Compares each video frame with the reference embedding
3. Combines visual similarity with OCR and YOLO results using weighted confidence:
   - Text evidence (OCR): 40%
   - Visual similarity (CLIP): 40%
   - Object evidence (YOLO): 20%

## Performance

- Model: ViT-B/32 (lightweight, fast)
- GPU acceleration: Automatic if CUDA available
- Typical processing time: ~50-100ms per frame comparison

## Troubleshooting

**Error: "CLIP dependencies not installed"**
- Run: `pip install -r requirements_clip.txt`

**Error: "CUDA out of memory"**
- CLIP will automatically fall back to CPU
- For large batches, process frames sequentially

**Low similarity scores**
- Ensure reference image is clear and shows the product prominently
- Try different reference images (front view, side view, etc.)
- Check that frames are not too blurry or dark


