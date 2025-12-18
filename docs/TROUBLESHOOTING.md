# Troubleshooting Guide

## Issue: Getting Mock Data Despite API Keys Being Configured

If you're seeing mock data even though you've configured all API keys, here are the common causes and solutions:

### 1. FFmpeg Path Issues

**Symptoms:**
- Errors like `"\\ROOT\\Desktop\\Whoofy\\node_modules\\ffmpeg-static\\ffmpeg.exe" - The system cannot find the path specified`
- Frame extraction fails
- Audio extraction fails

**Solution:**
- The code now properly normalizes paths for Windows
- If issues persist, verify FFmpeg is installed: `npm list ffmpeg-static`
- Try using system FFmpeg by installing it and adding to PATH

### 2. Instagram API 404 Errors

**Symptoms:**
- Logs show: `Request failed with status code 404`
- Instagram API calls fail
- System falls back to mock data

**Causes:**
- The RapidAPI Instagram scraper service you're using might have different endpoints
- Your API host might not match the service you subscribed to

**Solutions:**

1. **Check Your RapidAPI Service:**
   - Go to RapidAPI Hub
   - Find the Instagram scraper you subscribed to
   - Check the documentation for the correct endpoints

2. **Update Your .env:**
   ```env
   INSTAGRAM_RAPIDAPI_HOST=instagram-scraper21.p.rapidapi.com
   ```
   Make sure this matches the service you're actually using.

3. **Common Endpoint Patterns:**
   The code now tries multiple endpoint patterns:
   - `/post` with `url_or_code` parameter
   - `/post` with `url` parameter
   - `/post/{shortcode}`
   - `/media` with `shortcode` parameter
   - `/reel` with `url` parameter
   - And more variations

4. **Check API Documentation:**
   - Visit your RapidAPI service's documentation page
   - Look for the exact endpoint format
   - The code will log which endpoints it's trying

### 3. OpenAI Whisper Connection Issues

**Symptoms:**
- `read ECONNRESET` errors
- Transcription fails
- Falls back to mock transcription

**Solutions:**
- Check your OpenAI API key is valid
- Verify you have credits/quota available
- Check network connectivity
- Try again - sometimes it's a temporary network issue

### 4. Shazam API Issues

**Symptoms:**
- Audio recognition fails
- Falls back to mock results

**Solutions:**
- Verify your Shazam API key and host are correct
- Check the Shazam API documentation for the correct endpoint format
- The code tries multiple endpoint variations automatically

### 5. Environment Variables Not Loading

**Symptoms:**
- APIs show as "not configured" in logs
- All services return mock data

**Solutions:**
1. **Restart the dev server** after changing `.env`:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

2. **Check .env file location:**
   - Must be in the project root
   - Must be named exactly `.env` (not `.env.local` for server-side vars)

3. **Verify variable names:**
   ```env
   INSTAGRAM_RAPIDAPI_KEY=your_key_here
   INSTAGRAM_RAPIDAPI_HOST=instagram-scraper21.p.rapidapi.com
   SHAZAM_API_KEY=your_key_here
   SHAZAM_API_HOST=shazam-api7.p.rapidapi.com
   OPENAI_API_KEY=your_key_here
   APIFY_API_TOKEN=your_token_here
   ```

4. **Check for typos:**
   - Variable names are case-sensitive
   - No spaces around the `=` sign
   - No quotes needed (unless the value contains spaces)

### 6. Debugging Steps

1. **Check API Configuration Logs:**
   Look for this in your server logs:
   ```
   === API Configuration Status ===
   Instagram (RapidAPI): ✅ Configured
   Shazam (RapidAPI): ✅ Configured
   OpenAI Whisper: ✅ Configured
   ```

2. **Enable Debug Logging:**
   The code now logs which endpoints it's trying. Check your console for:
   ```
   Trying endpoint: /post with params: { url_or_code: '...' }
   ```

3. **Test APIs Individually:**
   You can test each API separately to isolate issues.

4. **Check Network Tab:**
   - Open browser DevTools
   - Go to Network tab
   - Submit a verification request
   - Check if API calls are being made
   - Look at response status codes

### 7. Common RapidAPI Instagram Services

Different RapidAPI services use different endpoints. Here are some common ones:

**instagram-scraper21.p.rapidapi.com:**
- Might use `/post` with different parameters
- Check the RapidAPI documentation for your specific service

**Other common services:**
- `instagram-scraper-api2.p.rapidapi.com`
- `instagram-api44.p.rapidapi.com`
- Each has different endpoint structures

### 8. Getting Help

If you're still having issues:

1. **Check the logs** - The code now provides detailed error messages
2. **Verify API keys** - Test them directly in RapidAPI's testing interface
3. **Check API quotas** - Make sure you haven't exceeded rate limits
4. **Review API documentation** - Each RapidAPI service has its own docs

### 9. Expected Behavior

**When APIs are configured but fail:**
- The system will log detailed error messages
- It will try multiple endpoint variations
- It will fall back to Apify if configured
- Only as a last resort will it return mock data

**When APIs are not configured:**
- The system will use mock data silently
- This is expected behavior for development

### 10. Verification Checklist

- [ ] All API keys are in `.env` file
- [ ] Server was restarted after adding keys
- [ ] API keys are valid (test in RapidAPI dashboard)
- [ ] API host matches the service you subscribed to
- [ ] You have API quota/credits available
- [ ] Network connection is stable
- [ ] Check logs for specific error messages




