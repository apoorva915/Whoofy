# External API Services

This directory contains integrations with external APIs used for data collection and processing.

## Services

### 1. Instagram API (`instagram-api.ts`)
- **Purpose**: Fetch profile data and reel metadata from Instagram
- **API**: Instagram Graph API
- **Features**:
  - Get user profiles (followers, bio, verification status)
  - Get reel metadata (likes, comments, views, captions)
  - Get user media list
  - Automatic fallback to mock data when not configured

### 2. Apify Scraper (`apify-scraper.ts`)
- **Purpose**: Scrape public Instagram data when official API is unavailable
- **API**: Apify Platform
- **Features**:
  - Scrape profile information
  - Scrape reel data including comments
  - Fallback service when Instagram API is not available

### 3. Shazam API (`shazam-api.ts`)
- **Purpose**: Identify music/audio tracks in videos
- **API**: Shazam API (via RapidAPI)
- **Features**:
  - Recognize audio from video URLs
  - Recognize audio from audio buffers
  - Returns track information (title, artist, album, etc.)

### 4. NoteGPT API (`notegpt-api.ts`)
- **Purpose**: Transcribe speech from videos
- **API**: NoteGPT API
- **Features**:
  - Transcribe from video URLs
  - Transcribe from audio buffers
  - Get transcription with timestamps
  - Support for multiple languages

## Usage

### Basic Usage

```typescript
import { externalApiService } from '@/services/external';

// Get Instagram profile
const profile = await externalApiService.getInstagramProfile('username');

// Get reel metadata
const reel = await externalApiService.getInstagramReel('https://instagram.com/reel/...');

// Transcribe video
const transcription = await externalApiService.transcribeVideo('https://...');

// Recognize audio
const audio = await externalApiService.recognizeAudio('https://...');
```

### Individual Services

```typescript
import { instagramApi, apifyScraper, shazamApi, notegptApi } from '@/services/external';

// Instagram API
if (instagramApi.isConfigured()) {
  const profile = await instagramApi.getUserProfile('username');
  const reel = await instagramApi.getReelMetadata('reel-url');
}

// Apify Scraper
const scraped = await apifyScraper.scrapeProfile('username');
const reelData = await apifyScraper.scrapeReel('reel-url');

// Shazam
const track = await shazamApi.recognizeFromVideo('video-url');

// NoteGPT
const transcript = await notegptApi.transcribeFromUrl('video-url');
```

## Configuration

All services check for API keys in environment variables. If not configured, they automatically fall back to mock data for development/testing.

### Required Environment Variables

```env
# Instagram Graph API
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_access_token

# Apify
APIFY_API_TOKEN=your_apify_token

# Shazam (via RapidAPI)
SHAZAM_API_KEY=your_rapidapi_key
SHAZAM_API_HOST=shazam-api7.p.rapidapi.com

# NoteGPT
NOTEGPT_API_KEY=your_notegpt_key
NOTEGPT_API_URL=https://api.notegpt.io
```

## Mock Mode

All services support mock mode when APIs are not configured. This allows:
- Development without API keys
- Testing without external dependencies
- Graceful degradation

Mock data is automatically returned when:
- API keys are not set in environment
- API calls fail
- Rate limits are exceeded

## Error Handling

All services use consistent error handling:
- `ExternalApiError`: General API errors
- `RateLimitError`: Rate limit exceeded (includes retry-after)
- Automatic fallback to mock data on errors

## Rate Limiting

Each service respects rate limits:
- Instagram: 200 requests/hour
- Apify: 30 requests/minute
- Shazam: 1000 requests/day
- NoteGPT: 10 requests/minute

Rate limit errors include retry-after information.














