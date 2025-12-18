# Gemini API Key Setup & Troubleshooting

## Getting Your API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key (it will start with `AIza...`)

## Setting Up the API Key

1. Create or edit your `.env` file in the project root
2. Add the following line:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
3. **Important**: Do NOT add quotes around the API key
4. **Important**: Remove any trailing spaces
5. Save the file
6. **Restart your Next.js dev server** (this is crucial - Next.js only loads env vars on startup)

## Common Issues

### "API key not valid" Error

If you're getting this error even with a valid key:

1. **Check for quotes**: Make sure your `.env` file looks like this:
   ```
   GEMINI_API_KEY=AIzaSy...your_key_here
   ```
   NOT like this:
   ```
   GEMINI_API_KEY="AIzaSy...your_key_here"  ❌
   GEMINI_API_KEY='AIzaSy...your_key_here'  ❌
   ```

2. **Check for whitespace**: Remove any spaces before or after the key:
   ```
   GEMINI_API_KEY=AIzaSy...your_key_here  ❌ (trailing space)
   GEMINI_API_KEY= AIzaSy...your_key_here  ❌ (leading space)
   ```

3. **Restart the server**: After changing `.env`, you MUST restart:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

4. **Verify the key**: Check that your key:
   - Starts with `AIza`
   - Is at least 39 characters long
   - Has no spaces or special characters (except the key itself)

5. **Check API enablement**: Make sure the Gemini API is enabled:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Enabled APIs"
   - Search for "Generative Language API" or "Gemini API"
   - Make sure it's enabled

6. **Check API key restrictions**: 
   - Go to [Google Cloud Console API Keys](https://console.cloud.google.com/apis/credentials)
   - Click on your API key
   - Check if there are any restrictions that might block the API

### Diagnostic Commands

The system will automatically log diagnostic information when initializing. Look for logs like:
```
Gemini API Key Diagnostics: {
  configured: true/false,
  source: 'env' | 'process.env' | 'none',
  keyLength: number,
  issues: [...]
}
```

## Testing Your API Key

You can test if your API key works by making a simple API call:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

Replace `YOUR_API_KEY` with your actual key.

## Fallback Behavior

If the API key is not configured or invalid, the system will:
- Use mock data for vision analysis
- Log warnings but continue processing
- Allow you to test the system without a valid API key

## Need Help?

If you're still having issues:
1. Check the server logs for diagnostic information
2. Verify your API key format
3. Make sure you've restarted the server after adding the key
4. Try generating a new API key from Google AI Studio

