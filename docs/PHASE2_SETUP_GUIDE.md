# Phase 2: Complete Setup Guide

This guide will help you set up all external API integrations for Phase 2.

## Overview

Phase 2 includes 4 external API services:
1. **Instagram Graph API** - Official Instagram data (optional, has fallback)
2. **Apify** - Web scraping service (optional, has fallback)
3. **Shazam API** - Audio/music recognition (optional, has fallback)
4. **NoteGPT API** - Video transcription (optional, has fallback)

**Important**: All services work with **mock data** by default, so you can use Phase 2 immediately without any API keys! Add keys only when you want real data.

---

## Quick Start (No API Keys Required)

You can use Phase 2 immediately without any setup:

```typescript
import { externalApiService } from '@/services/external';

// All of these work with mock data right now!
const profile = await externalApiService.getInstagramProfile('username');
const reel = await externalApiService.getInstagramReel('https://instagram.com/reel/...');
const transcript = await externalApiService.transcribeVideo('video-url');
const audio = await externalApiService.recognizeAudio('video-url');
```

**No configuration needed** - everything works out of the box with mock data!

---

## Optional: Setting Up Real API Keys

If you want to use real APIs instead of mock data, follow the guides below.

---

## 1. Instagram Graph API (Optional)

### What it does
- Fetches official Instagram profile data
- Gets reel metadata (likes, comments, views)
- Most reliable but requires app approval

### How to get API keys

1. **Go to Meta for Developers**
   - Visit: https://developers.facebook.com/
   - Sign in with your Facebook account

2. **Create a new app**
   - Click "My Apps" → "Create App"
   - Choose "Business" type
   - Fill in app details

3. **Add Instagram Basic Display or Instagram Graph API**
   - Go to "Add Products" → "Instagram Basic Display" or "Instagram Graph API"
   - Follow the setup wizard

4. **Get your credentials**
   - **App ID**: Found in "Settings" → "Basic"
   - **App Secret**: Found in "Settings" → "Basic" (click "Show")
   - **Access Token**: Generate in "Tools" → "Graph API Explorer"

5. **Add to `.env` file**:
   ```env
   INSTAGRAM_APP_ID=your_app_id_here
   INSTAGRAM_APP_SECRET=your_app_secret_here
   INSTAGRAM_ACCESS_TOKEN=your_access_token_here
   ```

### Notes
- Instagram API requires app review for production use
- Access tokens expire (usually 60 days)
- Rate limits: ~200 requests/hour
- **Fallback**: If not configured, uses Apify scraper or mock data

---

## 2. Apify (Optional)

### What it does
- Scrapes public Instagram data when official API unavailable
- Gets profile info, reel data, comments
- Good fallback for Instagram API

### How to get API key

1. **Sign up for Apify**
   - Visit: https://apify.com/
   - Click "Sign Up" (free tier available)

2. **Get your API token**
   - Go to: https://console.apify.com/account/integrations
   - Copy your "Personal API tokens"

3. **Add to `.env` file**:
   ```env
   APIFY_API_TOKEN=your_apify_token_here
   ```

### Notes
- Free tier: 5 compute units/month
- Rate limit: ~30 requests/minute
- **Fallback**: If not configured, uses mock data

---

## 3. Shazam API (Optional)

### What it does
- Recognizes music/audio tracks in videos
- Returns track info (title, artist, album)
- Useful for detecting copyrighted music

### How to get API key

1. **Sign up for RapidAPI**
   - Visit: https://rapidapi.com/
   - Sign up for free account

2. **Subscribe to Shazam API**
   - Search for "Shazam" in RapidAPI marketplace
   - Visit: https://rapidapi.com/apidojo/api/shazam
   - Click "Subscribe" → Choose plan (Basic plan is free)

3. **Get your API key**
   - Go to: https://rapidapi.com/developer/billing
   - Copy your "X-RapidAPI-Key"

4. **Add to `.env` file**:
   ```env
   SHAZAM_API_KEY=your_rapidapi_key_here
   SHAZAM_API_HOST=shazam-api7.p.rapidapi.com
   ```

### Notes
- Free tier: 500 requests/month
- Rate limit: ~1000 requests/day
- **Fallback**: If not configured, uses mock data

---

## 4. NoteGPT API (Optional)

### What it does
- Transcribes speech from videos
- Returns text with timestamps
- Supports multiple languages

### How to get API key

1. **Sign up for NoteGPT**
   - Visit: https://notegpt.io/ (or their API documentation)
   - Sign up for an account

2. **Get your API key**
   - Go to your account dashboard
   - Navigate to API settings
   - Generate or copy your API key

3. **Add to `.env` file**:
   ```env
   NOTEGPT_API_KEY=your_notegpt_key_here
   NOTEGPT_API_URL=https://api.notegpt.io
   ```

### Alternative: Use OpenAI Whisper
If NoteGPT is not available, you can use OpenAI's Whisper API:

```env
OPENAI_API_KEY=your_openai_key_here
```

Then modify the NoteGPT service to use OpenAI Whisper instead.

### Notes
- Check NoteGPT pricing on their website
- Rate limits vary by plan
- **Fallback**: If not configured, uses mock data

---

## Complete `.env` File Example

Here's a complete `.env` file with all Phase 2 options:

```env
# Node Environment
NODE_ENV=development

# Database (from Phase 1)
DATABASE_URL=postgresql://user:password@localhost:5432/whoofy?schema=public

# Redis (for Phase 6 - optional for now)
REDIS_HOST=localhost
REDIS_PORT=6379

# ============================================
# PHASE 2: External API Keys (All Optional)
# ============================================

# Instagram Graph API (Optional)
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token

# Apify (Optional)
APIFY_API_TOKEN=your_apify_api_token

# Shazam via RapidAPI (Optional)
SHAZAM_API_KEY=your_rapidapi_key
SHAZAM_API_HOST=shazam-api7.p.rapidapi.com

# NoteGPT (Optional)
NOTEGPT_API_KEY=your_notegpt_api_key
NOTEGPT_API_URL=https://api.notegpt.io

# OpenAI (Alternative to NoteGPT, Optional)
OPENAI_API_KEY=your_openai_api_key

# Application
PORT=3000
API_BASE_URL=http://localhost:3000
```

---

## Testing Your Setup

### 1. Test without API keys (Mock Mode)

Create a test file: `test-phase2.ts`

```typescript
import { externalApiService } from './src/services/external';

async function test() {
  console.log('Testing Phase 2 APIs (Mock Mode)...\n');

  // Test Instagram profile
  const profile = await externalApiService.getInstagramProfile('testuser');
  console.log('✅ Instagram Profile:', profile);

  // Test reel metadata
  const reel = await externalApiService.getInstagramReel('https://instagram.com/reel/abc123/');
  console.log('✅ Reel Metadata:', reel);

  // Test transcription
  const transcript = await externalApiService.transcribeVideo('https://example.com/video.mp4');
  console.log('✅ Transcription:', transcript.transcript);

  // Test audio recognition
  const audio = await externalApiService.recognizeAudio('https://example.com/video.mp4');
  console.log('✅ Audio Recognition:', audio.track);

  console.log('\n✅ All tests passed! Phase 2 is working.');
}

test().catch(console.error);
```

Run with: `npx tsx test-phase2.ts`

### 2. Test with real API keys

Once you add API keys to `.env`, restart your dev server and test again. The services will automatically use real APIs instead of mock data.

### 3. Check API configuration

```typescript
import { instagramApi, apifyScraper, shazamApi, notegptApi } from '@/services/external';

console.log('Instagram configured:', instagramApi.isConfigured());
console.log('Apify configured:', apifyScraper.isConfigured());
console.log('Shazam configured:', shazamApi.isConfigured());
console.log('NoteGPT configured:', notegptApi.isConfigured());
```

---

## Verification Checklist

- [ ] `.env` file exists in project root
- [ ] All desired API keys added to `.env`
- [ ] Environment variables loaded (restart dev server after adding keys)
- [ ] Test script runs successfully
- [ ] Services return real data (if API keys configured) or mock data (if not)

---

## Troubleshooting

### API keys not working?

1. **Check `.env` file location**
   - Must be in project root (same folder as `package.json`)
   - File name must be exactly `.env` (not `.env.example`)

2. **Restart dev server**
   - After adding/changing `.env` variables, restart: `npm run dev`

3. **Check environment variable names**
   - Must match exactly (case-sensitive)
   - No spaces around `=`

4. **Verify API keys are valid**
   - Test keys directly with API providers
   - Check for expired tokens (Instagram tokens expire)

### Services still using mock data?

- Check if API is configured: `service.isConfigured()`
- Verify `.env` variables are loaded
- Check logs for error messages
- Ensure API keys are correct format

### Rate limit errors?

- Wait for rate limit to reset
- Check your API plan limits
- Implement retry logic (already included in services)

---

## Recommended Setup Order

1. **Start with mock data** (no setup needed)
   - Test all functionality
   - Verify everything works

2. **Add NoteGPT or OpenAI** (easiest to set up)
   - Most useful for transcription
   - Quick to configure

3. **Add Shazam** (via RapidAPI)
   - Easy signup
   - Free tier available

4. **Add Apify** (if needed)
   - Good for scraping Instagram
   - Free tier available

5. **Add Instagram Graph API** (most complex)
   - Requires app approval
   - Best for production

---

## Cost Estimates

- **Instagram Graph API**: Free (but requires app approval)
- **Apify**: Free tier (5 compute units/month), then $49/month
- **Shazam (RapidAPI)**: Free tier (500 requests/month), then $9.99/month
- **NoteGPT**: Check their pricing (varies)
- **OpenAI Whisper**: Pay per use (~$0.006 per minute)

**Total for development**: $0 (all have free tiers)
**Total for production**: ~$50-100/month (depending on usage)

---

## Next Steps

Once Phase 2 is set up:

1. ✅ Test all services work
2. ✅ Verify mock/real data switching
3. ✅ Proceed to Phase 3 (Video Processing)
4. ✅ Or start using APIs in your application

---

## Support

- Check service-specific documentation in `src/services/external/README.md`
- Review error logs for specific API issues
- Test individual services separately to isolate problems

---

**Remember**: Phase 2 works perfectly without any API keys! Add keys only when you need real data.



