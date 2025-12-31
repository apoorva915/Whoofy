# CLIP Visual Similarity Setup Instructions

## Current Status

Based on your logs, CLIP visual similarity is **not working** because the dependencies are not installed. You're seeing this error:

```
CLIP exited with code 1: {"error": "CLIP dependencies not installed. Run: pip install torch torchvision pillow ftfy"}
```

## Quick Fix

Install CLIP dependencies:

```bash
# Navigate to your project directory
cd C:\Users\apoor\Desktop\Whoofy

# Activate your virtual environment (if using one)
.venv\Scripts\activate  # Windows

# Install CLIP dependencies
pip install -r yolo/requirements_clip.txt
```

Or install manually:

```bash
pip install torch torchvision pillow ftfy
pip install git+https://github.com/openai/CLIP.git
```

## Verify Installation

After installing, test CLIP:

```bash
python yolo/clip_similarity.py embed test_image.jpg
```

If it works, you should see JSON output with an embedding array.

## What Was Fixed

I've improved the code to:

1. **Better Error Logging**: Now clearly logs when CLIP dependencies are missing
2. **Visual Similarity Logging**: Logs similarity scores for each frame when CLIP is working
3. **Summary Logging**: Shows visual similarity summary at the end of analysis
4. **Response Inclusion**: Visual similarity results are included in the API response

## Expected Behavior After Installation

Once CLIP is installed, you should see:

1. **During Reference Image Setup**:
   ```
   Reference image embedding generated successfully - CLIP visual similarity enabled
   ```

2. **During Frame Analysis** (for each frame with similarity):
   ```
   Frame 8s - CLIP similarity: 0.425 (medium)
   ```

3. **At the End**:
   ```
   CLIP Visual Similarity Summary: 5/15 frames matched (avg: 0.387, max: 0.452)
   ```

4. **In API Response**:
   ```json
   {
     "vision": {
       "visualSummary": {
         "visualSimilaritySummary": {
           "averageSimilarity": 0.387,
           "maxSimilarity": 0.452,
           "matchedFrames": 5,
           "totalFrames": 15,
           "visibleSeconds": 10.0
         }
       }
     }
   }
   ```

## Troubleshooting

**If CLIP still doesn't work after installation:**

1. Check Python version (needs Python 3.7+):
   ```bash
   python --version
   ```

2. Verify torch installation:
   ```bash
   python -c "import torch; print(torch.__version__)"
   ```

3. Verify CLIP installation:
   ```bash
   python -c "import clip; print('CLIP installed')"
   ```

4. Check if the script path is correct:
   - Should be: `yolo/clip_similarity.py`
   - Make sure the file exists

## Notes

- CLIP will automatically use GPU if CUDA is available, otherwise falls back to CPU
- CPU processing is slower but still works
- The first run may take longer as CLIP downloads the model (~150MB)
