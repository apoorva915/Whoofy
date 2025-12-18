# How to Get RapidAPI Host Value

## Quick Answer

The **Host** value is shown on the API documentation page after you subscribe to an Instagram scraper API on RapidAPI.

## Step-by-Step Guide

### Step 1: Go to RapidAPI Marketplace
1. Visit https://rapidapi.com/
2. Search for "Instagram Scraper" or "Instagram API"

### Step 2: Choose an API
Popular options:
- **Instagram Scraper API2** - https://rapidapi.com/rockapis-rockapis-default/api/instagram-scraper-api2
- **Instagram Data Scraper** - Search in marketplace
- Any other Instagram scraper that looks good

### Step 3: Subscribe to the API
1. Click on the API you want
2. Click **"Subscribe"** button
3. Choose **"Basic"** (free) plan
4. Complete subscription

### Step 4: Find the Host Value
After subscribing, you'll see the API documentation page. Look for:

**Option A: In the Code Examples**
- Scroll down to see code examples (JavaScript, Python, etc.)
- Look for the `X-RapidAPI-Host` header
- Example:
  ```javascript
  headers: {
    'X-RapidAPI-Key': 'your-key-here',
    'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'  // <-- THIS IS THE HOST
  }
  ```

**Option B: In the Endpoints Section**
- Look at any endpoint documentation
- The host is usually shown in the request headers section
- Format: `something.p.rapidapi.com`

**Option C: In the API Details**
- Check the API overview/info section
- Host is often listed there

### Step 5: Copy the Host
The host will look like one of these:
- `instagram-scraper-api2.p.rapidapi.com`
- `instagram-data-scraper.p.rapidapi.com`
- `instagram-scraper-api.p.rapidapi.com`
- Or similar (depends on which API you choose)

### Step 6: Add to .env
```env
INSTAGRAM_RAPIDAPI_KEY=your_rapidapi_key_here
INSTAGRAM_RAPIDAPI_HOST=instagram-scraper-api2.p.rapidapi.com
```

## Visual Guide

When you're on an API page, you'll typically see:

```
┌─────────────────────────────────────┐
│  Instagram Scraper API              │
│  [Subscribe] [Test Endpoint]        │
├─────────────────────────────────────┤
│  Endpoints:                          │
│  • GET /user                         │
│  • GET /post                         │
│                                      │
│  Code Example:                       │
│  const options = {                   │
│    method: 'GET',                    │
│    headers: {                        │
│      'X-RapidAPI-Key': 'xxx',       │
│      'X-RapidAPI-Host': 'xxx.p.rapidapi.com'  ← HERE!
│    }                                 │
│  };                                  │
└─────────────────────────────────────┘
```

## Common Host Values

Here are some common Instagram scraper hosts:

1. **Instagram Scraper API2**
   - Host: `instagram-scraper-api2.p.rapidapi.com`
   - URL: https://rapidapi.com/rockapis-rockapis-default/api/instagram-scraper-api2

2. **Instagram Data Scraper**
   - Host: `instagram-data-scraper.p.rapidapi.com`
   - (Search in marketplace)

3. **Instagram Scraper**
   - Host: `instagram-scraper-api.p.rapidapi.com`
   - (Search in marketplace)

## Quick Test

Once you have both the key and host, you can test in the RapidAPI interface:
1. Go to the API page
2. Click "Test Endpoint"
3. Try the `/user` or `/post` endpoint
4. If it works, you have the right host!

## Important Notes

- The host is **specific to each API** - different APIs have different hosts
- The host format is always: `something.p.rapidapi.com`
- You can find it on **any API page** after subscribing
- It's usually in the code examples or endpoint documentation

## Still Can't Find It?

If you can't find the host:
1. Look at the **code examples** on the API page (JavaScript, cURL, etc.)
2. Check the **"Headers"** section in endpoint docs
3. Try the **"Test Endpoint"** feature - it shows the headers needed
4. The host is always visible in the request headers

---

**TL;DR**: Subscribe to an Instagram scraper API on RapidAPI, then look at the code examples or endpoint documentation - the `X-RapidAPI-Host` value is shown there!





