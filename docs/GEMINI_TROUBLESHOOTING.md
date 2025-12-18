# Gemini API Key Troubleshooting Guide

## Issue: "API key not valid" Error

Based on your Google Cloud Console screenshot, your API key is configured but still not working. Here's a step-by-step troubleshooting guide:

### Step 1: Verify the API Key Value

1. In Google Cloud Console, click on your API key "whoofy"
2. Click "Show key" to reveal the actual key value
3. **Copy the ENTIRE key** (it should be ~39 characters starting with `AIza`)
4. Compare it with what's in your `.env` file
5. Make sure they match exactly (no extra spaces, no missing characters)

### Step 2: Enable the Generative Language API

Even though your key is restricted to "Generative Language API", the API itself must be enabled:

1. Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. Make sure you're in the correct Google Cloud project
3. Click **"Enable"** if it's not already enabled
4. Wait a few minutes for the API to fully activate

### Step 3: Check API Key Restrictions

1. Click on your API key "whoofy" in the Credentials page
2. Check the "API restrictions" section:
   - Should show "Generative Language API" ✅
3. Check "Application restrictions":
   - If set to "IP addresses" or "HTTP referrers", make sure your server's IP/referrer is allowed
   - For development, you can temporarily set to "None" to test
4. Check "Key restrictions":
   - Make sure there are no other restrictions blocking the API

### Step 4: Test the API Key

Use the test endpoint we created:

1. Make sure your dev server is running
2. Visit: `http://localhost:3000/api/test-gemini`
3. This will show you:
   - If the key is being read correctly
   - The exact error from Google
   - Specific suggestions based on the error

### Step 5: Clear Next.js Cache

Sometimes Next.js caches environment variables:

```bash
# Stop your server (Ctrl+C)

# Delete Next.js cache
rm -rf .next
# Or on Windows PowerShell:
Remove-Item -Recurse -Force .next

# Restart
npm run dev
```

### Step 6: Verify .env File Format

Make sure your `.env` file looks exactly like this (no quotes, no spaces):

```
GEMINI_API_KEY=AIzaSyC5jlHZjdymFIJfJdId-DaeqfHvQ8AVPQk
```

NOT:
```
GEMINI_API_KEY="AIzaSyC5jlHZjdymFIJfJdId-DaeqfHvQ8AVPQk"  ❌
GEMINI_API_KEY= AIzaSyC5jlHZjdymFIJfJdId-DaeqfHvQ8AVPQk   ❌ (leading space)
GEMINI_API_KEY=AIzaSyC5jlHZjdymFIJfJdId-DaeqfHvQ8AVPQk    ❌ (trailing space)
```

### Step 7: Regenerate the API Key (Last Resort)

If nothing works, try creating a new API key:

1. In Google Cloud Console, go to Credentials
2. Click "Create credentials" > "API key"
3. Copy the new key immediately
4. Update your `.env` file with the new key
5. Restart your server

### Common Issues

#### Issue: API Key Works in Test Endpoint but Not in Frame Analysis
- **Solution**: Check if there are rate limits or quota restrictions
- Check your quota in: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

#### Issue: "403 Forbidden" Error
- **Solution**: The Generative Language API is not enabled for your project
- Enable it at: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com

#### Issue: "429 Too Many Requests" Error
- **Solution**: You've hit the rate limit
- Wait a few minutes and try again
- Check your quota limits

#### Issue: Key Works Sometimes but Not Always
- **Solution**: Check for IP restrictions or application restrictions
- Temporarily remove restrictions to test, then add them back properly

### Still Not Working?

1. Check the test endpoint response: `http://localhost:3000/api/test-gemini`
2. Share the error message from the test endpoint
3. Verify the API key value matches exactly between Google Cloud Console and your `.env` file
4. Make sure the Generative Language API is enabled (not just restricted on the key)

