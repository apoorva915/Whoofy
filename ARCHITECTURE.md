# System Architecture & Flow


## Data Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant VideoProc
    participant Vision
    participant Gemini
    participant Apify
    participant Shazam
    participant AudioExtractor
    participant DB
    
    User->>UI: Enter Reel URL
    UI->>API: POST /api/verify
    
    Note over API,Apify: Profile & Metadata Scraping
    API->>Apify: Scrape Profile Data
    Apify-->>API: Profile & Reel Metadata<br/>(Bio, Posts, Comments, Engagement)
    
    Note over API,VideoProc: Video Download & Processing
    API->>VideoProc: Download Video from URL
    VideoProc->>VideoProc: Validate Video File
    VideoProc-->>API: Video Downloaded & Stored
    
    Note over VideoProc,AudioExtractor: Audio Extraction
    VideoProc->>AudioExtractor: Extract Audio from Video
    AudioExtractor->>AudioExtractor: Convert to MP3<br/>(16kHz, Mono, 128kbps)
    AudioExtractor-->>VideoProc: Audio File Path
    
    Note over VideoProc,Shazam: Audio Recognition
    VideoProc->>Shazam: Recognize Audio Track
    Shazam-->>VideoProc: Track Info<br/>(Title, Artist, Album)
    
    Note over VideoProc,Vision: Frame Extraction & Analysis
    VideoProc->>VideoProc: Extract Frames (every 2s)
    VideoProc->>Vision: Analyze Frames
    
    par Parallel Frame Processing
        Vision->>Vision: YOLO Object Detection
        Vision->>Vision: OCR Text Detection
        Vision->>Vision: CLIP Visual Similarity
    end
    
    Vision->>Vision: Combine Results for Brand Detection
    Vision-->>API: Brand Detection Results<br/>(Confidence Scores)
    
    Note over API,Gemini: Text Analysis
    API->>Gemini: Analyze Sentiment<br/>(Caption & Transcript)
    Gemini-->>API: Sentiment Analysis<br/>(Positive/Negative/Neutral)
    
    API->>Gemini: Analyze Niche<br/>(Bio & Latest Posts)
    Gemini-->>API: Niche Detection<br/>(Multiple Niches with Confidence)
    
    Note over API: Engagement Verification
    API->>API: Comment Analysis<br/>(Bot Detection)
    API->>API: Engagement Pattern Analysis<br/>(Spike Detection, Ratios)
    
    API->>DB: Store All Results
    API-->>UI: Complete Verification Results
    UI-->>User: Display Results
```

## Component Overview

### Frontend (Next.js)
- **page.tsx**: Main UI with tabs for scraping, analysis, and verification
- Handles user input and displays results

### API Routes
- **/api/verify**: Complete verification pipeline
- **/api/profile**: Scrape Instagram profile and reel data
- **/api/analyze**: Video frame analysis (YOLO, OCR, CLIP)
- **/api/sentiment/gemini**: Sentiment analysis using Gemini
- **/api/verify/engagement**: Engagement authenticity verification
- **/api/creators/niche-analysis**: Creator niche detection

### Services
- **Video Processor**: Downloads videos, extracts frames and audio
- **Vision Analyzer**: Processes frames with YOLO, OCR, and CLIP
- **Sentiment Service**: Uses Gemini AI for sentiment analysis
- **Engagement Service**: Detects fake engagement patterns
- **Niche Service**: Determines creator niches using Gemini

### External Integrations
- **Google Gemini**: Sentiment analysis and niche detection
- **Apify**: Instagram data scraping
- **Shazam**: Audio/music recognition
- **OpenAI**: Video transcription

### AI Models
- **YOLO v8**: Object detection in video frames
- **Tesseract OCR**: Text extraction from frames
- **CLIP**: Visual similarity matching for brand detection

### Storage
- **PostgreSQL**: Stores verification results, campaigns, creators
- **Local Storage**: Temporary video files and extracted frames
- **Redis**: Job queue for async processing (optional)

## Verification Flow

1. **User submits reel URL** → Frontend sends request to `/api/verify`
2. **Profile Scraping** → Apify scrapes Instagram:
   - Profile data (bio, followers, verification status)
   - Reel metadata (likes, comments, views, caption)
   - Latest posts (for historical comparison)
   - Comments data
3. **Video Download** → Video processor downloads video from URL and validates file
4. **Audio Extraction** → Audio extracted from video:
   - Converted to MP3 format
   - 16kHz sample rate, mono channel, 128kbps bitrate
   - Saved to local storage
5. **Audio Recognition** → Shazam API recognizes audio track (title, artist, album)
6. **Frame Extraction** → Frames extracted every 2 seconds (configurable)
7. **Parallel Frame Analysis** → Each frame analyzed simultaneously:
   - YOLO for object detection
   - OCR for text extraction
   - CLIP for visual similarity
8. **Brand Detection** → Results combined to detect brand presence:
   - Text matching (OCR)
   - Object context (YOLO)
   - Visual similarity (CLIP)
   - Confidence scoring
9. **Sentiment Analysis** → Gemini analyzes:
   - Caption sentiment separately
   - Transcript sentiment separately
   - Positive publicity assessment
10. **Niche Analysis** → Gemini analyzes:
    - Creator bio
    - Latest 5 posts (captions, types, engagement)
    - Returns multiple niches with confidence scores
11. **Engagement Verification** → Pattern analysis:
    - Comment analysis (bot detection)
    - Like-to-view ratio check
    - Engagement rate check
    - Like spike detection (Z-score method)
    - Rapid growth detection
12. **Results Storage** → All results saved to PostgreSQL
13. **Response** → Complete verification results returned to frontend

## Key Features

- **Multi-modal Analysis**: Combines video, audio, text, and engagement data
- **Parallel Processing**: Frames analyzed in parallel for performance
- **AI-Powered**: Uses Gemini AI for sentiment and niche detection
- **Computer Vision**: YOLO, OCR, and CLIP for comprehensive video analysis
- **Engagement Verification**: Statistical analysis to detect fake engagement
- **Scalable**: Supports async processing with Redis queue
