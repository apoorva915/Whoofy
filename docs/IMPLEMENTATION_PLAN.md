# Whoofy - Implementation Plan

## Overview
This document outlines a structured, phased approach to building the AI Reel Verification System. The plan is organized into 6 phases, each building upon the previous one.

---

## Phase 1: Foundation & Infrastructure Setup
**Goal:** Set up core infrastructure, types, configuration, and database

### 1.1 Dependencies Installation
- [ ] Install database client (Prisma + PostgreSQL or MongoDB)
- [ ] Install validation library (Zod)
- [ ] Install HTTP client (Axios)
- [ ] Install environment variable management (dotenv)
- [ ] Install logging library (Winston or Pino)
- [ ] Install queue system (BullMQ + Redis) for background jobs
- [ ] Install video processing libraries (fluent-ffmpeg, @ffmpeg/ffmpeg)
- [ ] Install AI/ML SDKs (OpenAI SDK, Google Cloud Vision, HuggingFace Inference)

### 1.2 Type Definitions
- [ ] Define `Campaign` type (requirements, rules, brand info)
- [ ] Define `Creator` type (profile, eligibility criteria)
- [ ] Define `Submission` type (reel URL, metadata, status)
- [ ] Define `VerificationResult` type (all checkpoints, scores, status)
- [ ] Define API request/response types
- [ ] Define detection result types (objects, brands, sentiment, etc.)

### 1.3 Environment Configuration
- [ ] Create `.env.example` with all required variables
- [ ] Set up environment validation (Zod schema)
- [ ] Configure external API keys (Instagram, Apify, Shazam, NoteGPT, OpenAI, etc.)
- [ ] Set up database connection configuration
- [ ] Configure Redis connection for queue

### 1.4 Database Schema & Models
- [ ] Design database schema (Campaigns, Creators, Submissions, VerificationResults)
- [ ] Create Prisma schema or MongoDB models
- [ ] Set up database migrations
- [ ] Create model helper functions (CRUD operations)

### 1.5 Utility Functions
- [ ] Logger setup (structured logging)
- [ ] Error handling utilities (custom error classes)
- [ ] Validation helpers
- [ ] Constants file (status codes, error messages)

**Deliverables:** Working database, type-safe codebase, environment setup

---

## Phase 2: External API Integrations
**Goal:** Integrate all external services needed for data collection

### 2.1 Instagram Graph API Client
- [ ] Set up authentication (OAuth flow)
- [ ] Implement profile data fetching (followers, niche, location)
- [ ] Implement reel metadata fetching
- [ ] Implement engagement metrics fetching
- [ ] Handle rate limiting and error cases

### 2.2 Apify Scraper Integration
- [ ] Set up Apify client
- [ ] Implement profile scraping fallback
- [ ] Implement reel URL scraping
- [ ] Implement caption and comments extraction
- [ ] Handle scraping errors gracefully

### 2.3 Shazam API Integration
- [ ] Set up Shazam API client
- [ ] Implement audio fingerprinting
- [ ] Implement music/audio track identification
- [ ] Return track metadata

### 2.4 NoteGPT API Integration
- [ ] Set up NoteGPT client
- [ ] Implement speech-to-text transcription
- [ ] Handle video URL processing
- [ ] Return transcript with timestamps

**Deliverables:** All external APIs integrated and tested

---

## Phase 3: Video Processing Pipeline
**Goal:** Build the core video processing and analysis infrastructure

### 3.1 Video Download Service
- [ ] Implement video downloader (from Instagram URLs)
- [ ] Handle different video formats
- [ ] Implement retry logic and error handling
- [ ] Set up temporary storage management

### 3.2 Frame Extraction Service
- [ ] Extract key frames from video (every N seconds)
- [ ] Extract frames at specific timestamps
- [ ] Optimize frame quality for AI processing
- [ ] Clean up temporary files

### 3.3 Video Storage Service
- [ ] Set up cloud storage (AWS S3, Cloudinary, or local)
- [ ] Implement video upload/download
- [ ] Implement cache management
- [ ] Set up cleanup policies

### 3.4 Transcription Services
- [ ] Implement caption extraction (from Instagram metadata)
- [ ] Integrate speech-to-text (NoteGPT)
- [ ] Combine multiple transcription sources
- [ ] Extract text from video frames (OCR)

**Deliverables:** Complete video processing pipeline

---

## Phase 4: AI Model Integration & Detection Services
**Goal:** Integrate AI models for content analysis

### 4.1 Vision Model Integration
- [ ] Set up OpenAI Vision API or Google Cloud Vision
- [ ] Implement object detection (detect products, brands, people)
- [ ] Implement brand logo detection
- [ ] Implement OCR (text extraction from frames)
- [ ] Implement scene understanding

### 4.2 NLP Model Integration
- [ ] Set up OpenAI GPT or HuggingFace models
- [ ] Implement sentiment analysis (positive/negative/neutral)
- [ ] Implement brand mention detection (in text/transcript)
- [ ] Implement keyword extraction
- [ ] Implement language detection

### 4.3 Detection Services Implementation
- [ ] **Object Detection Service**: Detect products, objects in video
- [ ] **Brand Detection Service**: Detect brand logos, products, mentions
- [ ] **Text Detection Service**: Extract all text (OCR + captions)
- [ ] **Brand Mention Detection**: Find brand names in audio/text
- [ ] **Sentiment Analysis Service**: Analyze overall sentiment

**Deliverables:** All AI detection services working

---

## Phase 5: Verification Logic
**Goal:** Build the core verification engine that checks all campaign requirements

### 5.1 Creator Eligibility Verification
- [ ] Check follower threshold
- [ ] Verify niche match (Tech, Fashion, Food, etc.)
- [ ] Verify gender (if required)
- [ ] Verify age (if required)
- [ ] Verify language
- [ ] Verify location/region

### 5.2 Content Authenticity Verification
- [ ] Check for fake views/engagement (compare metrics)
- [ ] Verify content is original (not reposted)
- [ ] Check timestamp of promotion
- [ ] Detect reused content patterns

### 5.3 Brand Integration Verification
- [ ] Verify product/service visibility in video
- [ ] Check brand name mention (caption/audio/text-on-screen)
- [ ] Analyze tone (positive/neutral/negative)
- [ ] Detect competitor promotion
- [ ] Check for misleading claims

### 5.4 Campaign Rules Checker
- [ ] Verify script compliance (if provided)
- [ ] Check mandatory hashtags/keywords
- [ ] Verify content format (UGC, tutorial, testimonial, unboxing)
- [ ] Check additional brand instructions
- [ ] Score against all validation checkpoints

### 5.5 Final Status Determination
- [ ] Aggregate all verification results
- [ ] Calculate overall score
- [ ] Determine status: "Approved", "Needs Revision", "Rejected"
- [ ] Generate detailed report with all findings

**Deliverables:** Complete verification engine

---

## Phase 6: API Endpoints & Background Processing
**Goal:** Build API endpoints and async processing system

### 6.1 Verification Worker
- [ ] Set up BullMQ queue for async processing
- [ ] Create verification worker that processes jobs
- [ ] Implement job retry logic
- [ ] Implement progress tracking
- [ ] Handle job failures gracefully

### 6.2 API Endpoints
- [ ] **POST /api/verify**: Submit reel for verification (enqueue job)
- [ ] **GET /api/verify/[id]**: Get verification status and results
- [ ] **POST /api/campaigns**: Create campaign
- [ ] **GET /api/campaigns**: List campaigns
- [ ] **GET /api/campaigns/[id]**: Get campaign details
- [ ] **POST /api/submissions**: Create submission
- [ ] **GET /api/submissions**: List submissions
- [ ] **GET /api/submissions/[id]**: Get submission details
- [ ] **GET /api/creators**: List creators
- [ ] **GET /api/creators/[id]**: Get creator details
- [ ] **GET /api/health**: Health check endpoint

### 6.3 Middleware
- [ ] Authentication middleware
- [ ] Rate limiting middleware
- [ ] Error handling middleware
- [ ] Request validation middleware

### 6.4 Frontend Integration
- [ ] Connect frontend form to `/api/verify` endpoint
- [ ] Display verification status (loading, processing, completed)
- [ ] Show verification results (objects detected, sentiment, status)
- [ ] Handle errors gracefully

**Deliverables:** Complete API system with async processing

---

## Phase 7: Testing & Optimization
**Goal:** Test, optimize, and prepare for production

### 7.1 Testing
- [ ] Unit tests for detection services
- [ ] Unit tests for verification logic
- [ ] Integration tests for API endpoints
- [ ] End-to-end tests for full verification flow
- [ ] Test with real Instagram reels

### 7.2 Performance Optimization
- [ ] Optimize video processing (parallel frame extraction)
- [ ] Cache API responses
- [ ] Optimize AI model calls (batch processing)
- [ ] Implement request queuing and throttling

### 7.3 Error Handling & Monitoring
- [ ] Comprehensive error handling
- [ ] Set up error tracking (Sentry or similar)
- [ ] Add monitoring and alerting
- [ ] Log all verification attempts

### 7.4 Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Code documentation
- [ ] Deployment guide
- [ ] User guide

**Deliverables:** Production-ready system

---

## Technology Stack Recommendations

### Core
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM (or MongoDB with Mongoose)

### AI/ML Services
- **Vision**: OpenAI GPT-4 Vision API or Google Cloud Vision API
- **NLP**: OpenAI GPT-4 or HuggingFace Inference API
- **Speech-to-Text**: NoteGPT API (as specified) or OpenAI Whisper
- **Audio Recognition**: Shazam API

### Infrastructure
- **Queue**: BullMQ with Redis
- **Storage**: AWS S3 or Cloudinary (for videos)
- **Video Processing**: fluent-ffmpeg or @ffmpeg/ffmpeg
- **HTTP Client**: Axios
- **Validation**: Zod

### External APIs
- Instagram Graph API
- Apify Scraper
- Shazam API
- NoteGPT API

---

## Implementation Order Priority

1. **Start with Phase 1** - Foundation is critical
2. **Then Phase 2** - Need external APIs early for testing
3. **Then Phase 3** - Video processing is core functionality
4. **Then Phase 4** - AI models are the heart of the system
5. **Then Phase 5** - Verification logic ties everything together
6. **Finally Phase 6** - API endpoints expose functionality
7. **Phase 7** - Polish and production readiness

---

## Estimated Timeline (Rough Estimates)

- **Phase 1**: 2-3 days
- **Phase 2**: 3-4 days
- **Phase 3**: 2-3 days
- **Phase 4**: 4-5 days
- **Phase 5**: 3-4 days
- **Phase 6**: 2-3 days
- **Phase 7**: 2-3 days

**Total**: ~18-25 days (depending on complexity and testing)

---

## Key Decisions Needed

1. **Database**: PostgreSQL vs MongoDB?
2. **AI Provider**: OpenAI vs Google Cloud vs HuggingFace?
3. **Storage**: AWS S3 vs Cloudinary vs Local?
4. **Queue**: BullMQ vs other queue systems?
5. **Hosting**: Vercel vs AWS vs other?

---

## Next Steps

1. Review and approve this plan
2. Make key technology decisions
3. Set up development environment
4. Begin Phase 1 implementation

