# System Architecture & Flow

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Next.js Web UI<br/>page.tsx]
    end
    
    subgraph "API Layer"
        API_Verify[/api/verify<br/>Full Verification]
        API_Profile[/api/profile<br/>Profile Scraping]
        API_Analyze[/api/analyze<br/>Video Analysis]
        API_Sentiment[/api/sentiment/gemini<br/>Sentiment Analysis]
        API_Engagement[/api/verify/engagement<br/>Engagement Verification]
        API_Niche[/api/creators/niche-analysis<br/>Niche Detection]
    end
    
    subgraph "Service Layer"
        VideoProc[Video Processor<br/>Download & Extract]
        VisionAnalyzer[Vision Analyzer<br/>Frame Analysis]
        SentimentService[Sentiment Service<br/>Gemini AI]
        EngagementService[Engagement Service<br/>Pattern Analysis]
        NicheService[Niche Service<br/>Gemini AI]
    end
    
    subgraph "External APIs"
        Gemini[Google Gemini<br/>Sentiment & Niche]
        Apify[Apify Scraper<br/>Instagram Data]
        Shazam[Shazam API<br/>Audio Recognition]
        OpenAI[OpenAI API<br/>Transcription]
    end
    
    subgraph "AI Processing"
        YOLO[YOLO v8<br/>Object Detection]
        OCR[Tesseract OCR<br/>Text Detection]
        CLIP[CLIP<br/>Visual Similarity]
    end
    
    subgraph "Storage"
        DB[(PostgreSQL<br/>Database)]
        LocalStorage[Local Storage<br/>Videos & Frames]
        Redis[(Redis<br/>Queue)]
    end
    
    UI -->|Submit Reel URL| API_Verify
    UI -->|Scrape Profile| API_Profile
    UI -->|Analyze Video| API_Analyze
    UI -->|Check Sentiment| API_Sentiment
    UI -->|Verify Engagement| API_Engagement
    UI -->|Detect Niche| API_Niche
    
    API_Verify --> VideoProc
    API_Verify --> VisionAnalyzer
    API_Verify --> SentimentService
    API_Verify --> EngagementService
    
    API_Profile --> Apify
    API_Analyze --> VideoProc
    API_Analyze --> VisionAnalyzer
    API_Sentiment --> SentimentService
    API_Engagement --> EngagementService
    API_Niche --> NicheService
    
    VideoProc -->|Download Video| LocalStorage
    VideoProc -->|Extract Frames| VisionAnalyzer
    VideoProc -->|Extract Audio| Shazam
    VideoProc -->|Extract Audio| OpenAI
    
    VisionAnalyzer -->|Process Frames| YOLO
    VisionAnalyzer -->|Process Frames| OCR
    VisionAnalyzer -->|Process Frames| CLIP
    
    SentimentService --> Gemini
    NicheService --> Gemini
    
    API_Profile -->|Store Data| DB
    EngagementService -->|Store Results| DB
    
    VideoProc -.->|Queue Jobs| Redis
    
    style UI fill:#e1f5ff
    style API_Verify fill:#fff4e1
    style API_Profile fill:#fff4e1
    style API_Analyze fill:#fff4e1
    style API_Sentiment fill:#fff4e1
    style API_Engagement fill:#fff4e1
    style VideoProc fill:#f0f0f0
    style VisionAnalyzer fill:#f0f0f0
    style SentimentService fill:#f0f0f0
    style Gemini fill:#c8e6c9
    style Apify fill:#c8e6c9
    style DB fill:#ffccbc
    style LocalStorage fill:#ffccbc
```

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
    participant DB
    
    User->>UI: Enter Reel URL
    UI->>API: POST /api/verify
    
    API->>Apify: Scrape Profile Data
    Apify-->>API: Profile & Reel Metadata
    
    API->>VideoProc: Download Video
    VideoProc->>VideoProc: Extract Frames (every 2s)
    VideoProc->>Vision: Analyze Frames
    
    par Parallel Processing
        Vision->>Vision: YOLO Object Detection
        Vision->>Vision: OCR Text Detection
        Vision->>Vision: CLIP Visual Similarity
    end
    
    Vision-->>API: Brand Detection Results
    
    API->>Gemini: Analyze Sentiment
    Gemini-->>API: Sentiment Analysis
    
    API->>API: Engagement Verification
    API->>DB: Store Results
    
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
2. **Profile Scraping** → Apify scrapes Instagram profile and reel metadata
3. **Video Download** → Video processor downloads video from URL
4. **Frame Extraction** → Frames extracted every 2 seconds
5. **Parallel Analysis** → Each frame analyzed with:
   - YOLO for object detection
   - OCR for text extraction
   - CLIP for visual similarity
6. **Brand Detection** → Results combined to detect brand presence
7. **Sentiment Analysis** → Gemini analyzes caption and transcript
8. **Engagement Verification** → Pattern analysis detects fake engagement
9. **Results Storage** → Results saved to PostgreSQL
10. **Response** → Complete verification results returned to frontend

## Key Features

- **Multi-modal Analysis**: Combines video, audio, text, and engagement data
- **Parallel Processing**: Frames analyzed in parallel for performance
- **AI-Powered**: Uses Gemini AI for sentiment and niche detection
- **Computer Vision**: YOLO, OCR, and CLIP for comprehensive video analysis
- **Engagement Verification**: Statistical analysis to detect fake engagement
- **Scalable**: Supports async processing with Redis queue
