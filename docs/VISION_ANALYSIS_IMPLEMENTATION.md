# Vision Analysis Implementation

## Overview
This document describes the vision analysis implementation using Google Gemini Vision API to analyze video frames and detect objects and brands.

## Implementation Details

### 1. Types (`src/types/vision.ts`)
- **FrameAnalysis**: Result of analyzing a single frame
  - `timestamp`: Time in seconds when frame appears
  - `objects`: Array of detected object names
  - `brands`: Array of detected brands with confidence scores

- **VisualSummary**: Aggregated results from all frames
  - `uniqueObjects`: All unique objects detected across frames
  - `brandsDetected`: Aggregated brand detection with frame counts and visibility duration
  - `frameAnalyses`: Array of individual frame analyses

### 2. Frame Analyzer Service (`src/services/vision/frame-analyzer.ts`)
The `FrameAnalyzer` class provides:

- **`analyzeFrame()`**: Analyzes a single frame using Gemini Vision API
  - Reads frame image file
  - Sends to Gemini with prompt to detect objects and brands
  - Parses JSON response
  - Handles errors gracefully with fallback to mock data

- **`analyzeFrames()`**: Analyzes all frames and creates visual summary
  - Processes frames sequentially with rate limiting (100ms delay)
  - Aggregates unique objects
  - Aggregates brands across frames (using max confidence)
  - Calculates total visible seconds for each brand

**Key Features:**
- Uses Gemini 1.5 Flash model for fast analysis
- Handles mock frames for development
- Robust JSON parsing with fallback text extraction
- Rate limiting to avoid API throttling
- Comprehensive error handling

### 3. Integration

#### Video Processor (`src/services/video/processor.ts`)
- Added `analyzeVision` option (default: true)
- Calls `frameAnalyzer.analyzeFrames()` after frame extraction
- Returns `visualAnalysis` in `VideoProcessingResult`

#### API Endpoint (`src/app/api/verify/route.ts`)
- Includes visual analysis results in response
- Returns summary with:
  - Unique objects list
  - Brands detected with confidence and visibility metrics
  - Preview of frame analyses (first 5 frames)

#### Frontend (`src/app/page.tsx`)
- Displays visual analysis results in dedicated section
- Shows:
  - All detected objects as tags
  - Brands with confidence scores and visibility metrics
  - Frame-by-frame analysis preview

### 4. Environment Configuration

Add to `.env`:
```bash
GEMINI_API_KEY=your_gemini_api_key
```

Get API key from: https://makersuite.google.com/app/apikey

### 5. Usage

The vision analysis runs automatically when processing a video:

```typescript
const result = await videoProcessor.processVideo(url, {
  extractFrames: true,
  frameInterval: 2,
  analyzeVision: true, // default: true
});
```

Access results:
```typescript
if (result.visualAnalysis) {
  console.log('Objects:', result.visualAnalysis.uniqueObjects);
  console.log('Brands:', result.visualAnalysis.brandsDetected);
}
```

### 6. API Response Structure

```json
{
  "success": true,
  "data": {
    "visualAnalysis": {
      "uniqueObjects": ["chocolate bar", "hand", "background"],
      "brandsDetected": [
        {
          "name": "Cadbury Dairy Milk",
          "confidence": 0.85,
          "totalFrames": 3,
          "totalVisibleSeconds": 6.0
        }
      ],
      "frameCount": 15,
      "frameAnalyses": [
        {
          "timestamp": 0.0,
          "objectCount": 3,
          "brandCount": 1,
          "objects": ["chocolate bar", "hand"],
          "brands": [{"name": "Cadbury Dairy Milk", "confidence": 0.85}]
        }
      ]
    }
  }
}
```

### 7. Error Handling

- If Gemini API key is not set, returns mock data
- If API call fails, falls back to mock data
- If JSON parsing fails, attempts text extraction
- All errors are logged but don't break the pipeline

### 8. Performance Considerations

- Rate limiting: 100ms delay between frame analyses
- Uses Gemini 1.5 Flash (faster than Pro)
- Processes frames sequentially (can be parallelized in future)
- Mock mode available for development without API key

### 9. Future Enhancements

- Parallel frame processing for faster analysis
- Caching of frame analyses
- More sophisticated brand detection (logo recognition)
- Object tracking across frames
- Confidence threshold filtering
- Custom prompt templates per campaign

