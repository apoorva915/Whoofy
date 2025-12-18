# OpenAI Whisper API Setup (Simple!)

## Why OpenAI Whisper?

✅ **Much simpler** than NoteGPT - just an API key!  
✅ **Easy to get** - sign up, get key, done  
✅ **High quality** - OpenAI's Whisper model is excellent  
✅ **Free tier** - $5 free credit to start  
✅ **Pay as you go** - Only ~$0.006 per minute of audio  

## How to Get Your API Key

### Step 1: Sign Up for OpenAI
1. Go to https://platform.openai.com/
2. Click **"Sign Up"** (or "Log In" if you have an account)
3. Create account (can use Google/Microsoft login)

### Step 2: Get Your API Key
1. Once logged in, go to: https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Give it a name (e.g., "Whoofy Transcription")
4. Click **"Create secret key"**
5. **Copy the key immediately** - you won't see it again!

### Step 3: Add to `.env` File
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

That's it! Just paste your API key.

## Pricing

- **Free Tier**: $5 free credit when you sign up
- **Pay As You Go**: ~$0.006 per minute of audio transcribed
- **Example**: 
  - 1 minute video = $0.006
  - 10 minutes = $0.06
  - 100 minutes = $0.60

Very affordable!

## Testing

After adding your API key:

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Try verifying a reel URL

3. Check the logs - you should see real transcription instead of "mock"

## Benefits Over NoteGPT

| Feature | OpenAI Whisper | NoteGPT |
|---------|---------------|---------|
| Setup | ✅ Just API key | ❌ Hard to find |
| Quality | ✅ Excellent | ? Unknown |
| Pricing | ✅ $0.006/min | ? Unknown |
| Documentation | ✅ Great | ❌ Limited |
| Reliability | ✅ Very reliable | ? Unknown |

## Usage

The system automatically uses OpenAI Whisper if you have the API key configured. No code changes needed!

## Troubleshooting

### Still seeing mock transcription?
- Check your `.env` file has `OPENAI_API_KEY` set
- Restart dev server after adding key
- Verify the key is correct (starts with `sk-`)

### Getting errors?
- Check your OpenAI account has credits
- Verify the API key is active
- Check OpenAI status: https://status.openai.com/

### Rate limits?
- OpenAI has generous rate limits
- Free tier: 3 requests/minute
- Paid: Much higher limits

## Alternative: NoteGPT

If you still want to use NoteGPT:
1. Find their website/API documentation
2. Sign up and get API key
3. Add to `.env`:
   ```env
   NOTEGPT_API_KEY=your_key
   NOTEGPT_API_URL=https://api.notegpt.io
   ```

But OpenAI Whisper is recommended - it's simpler and more reliable!

---

**That's it!** Just get an OpenAI API key and you're done. Much simpler than NoteGPT! 🎉





