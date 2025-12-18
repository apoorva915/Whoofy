# Simple Instagram API Setup (RapidAPI)

## Overview

We've replaced the complex Instagram Graph API with a simple RapidAPI-based scraper that only requires an API key - no app setup, no OAuth, no complex configuration!

## How to Get Your API Key

### Step 1: Sign Up for RapidAPI
1. Go to https://rapidapi.com/
2. Sign up for a free account (no credit card required for free tier)

### Step 2: Find an Instagram Scraper
1. Search for "Instagram Scraper" in the RapidAPI marketplace
2. Popular options:
   - **Instagram Scraper API** by `instagram-scraper-api2`
   - **Instagram Data Scraper** by various providers
   - Any Instagram scraper that supports:
     - Getting user profiles
     - Getting post/reel data

### Step 3: Subscribe to a Plan
1. Click on any Instagram scraper API
2. Click "Subscribe" 
3. Choose the **Basic (Free)** plan (usually 500-1000 requests/month)
4. No credit card needed for free tier!

### Step 4: Get Your API Key and Host
1. Go to your RapidAPI dashboard: https://rapidapi.com/developer/billing
2. Copy your **X-RapidAPI-Key** (it's a long string)

### Step 5: Get the Host Value
The **Host** is shown on the API documentation page. Here's where to find it:

1. Go back to the Instagram scraper API page you subscribed to
2. Scroll down to see **code examples** (JavaScript, Python, cURL, etc.)
3. Look for `X-RapidAPI-Host` in the headers - that's your host!
4. Example: `instagram-scraper-api2.p.rapidapi.com`

**Or** look in the endpoint documentation - the host is always shown in the request headers section.

**See detailed guide**: `docs/HOW_TO_GET_RAPIDAPI_HOST.md`

### Step 6: Add to `.env` File
```env
INSTAGRAM_RAPIDAPI_KEY=your_rapidapi_key_here
INSTAGRAM_RAPIDAPI_HOST=instagram-scraper-api2.p.rapidapi.com
```

Replace:
- `your_rapidapi_key_here` with your actual RapidAPI key
- `instagram-scraper-api2.p.rapidapi.com` with the host from the API you subscribed to

## Example APIs

### Option 1: Instagram Scraper API2
- **Host**: `instagram-scraper-api2.p.rapidapi.com`
- **Free Tier**: Usually 500 requests/month
- **URL**: https://rapidapi.com/rockapis-rockapis-default/api/instagram-scraper-api2

### Option 2: Instagram Data Scraper
- **Host**: `instagram-data-scraper.p.rapidapi.com`
- **Free Tier**: Usually 1000 requests/month
- Search in RapidAPI marketplace

## Testing

After adding your API key:

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Try verifying a reel URL again

3. Check the logs - you should see real data instead of "mock" messages

## Benefits

✅ **Simple**: Just an API key, no complex setup  
✅ **Free Tier**: Most APIs offer 500-1000 free requests/month  
✅ **No OAuth**: No need to set up Facebook/Instagram apps  
✅ **No App Review**: No waiting for Meta approval  
✅ **Quick Setup**: 5 minutes to get started  

## Troubleshooting

### Still seeing mock data?
- Check your `.env` file has the correct key
- Restart the dev server after adding the key
- Check the API host matches the one from RapidAPI
- Verify your RapidAPI subscription is active

### Rate limit errors?
- Free tiers usually have 500-1000 requests/month
- Wait for the limit to reset or upgrade to a paid plan

### API not working?
- Try a different Instagram scraper API from RapidAPI
- Check the API documentation for correct endpoint names
- Some APIs might use slightly different response formats

## Cost

- **Free Tier**: 500-1000 requests/month (usually enough for testing)
- **Paid Plans**: Start at $5-10/month for more requests
- **No credit card required** for free tier!

---

**That's it!** Much simpler than Instagram Graph API. Just get a RapidAPI key and you're done! 🎉

