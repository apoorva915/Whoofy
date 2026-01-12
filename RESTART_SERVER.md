# 🔄 Restart Your Server

## The Problem

Your Next.js server is still using the cached system environment variable `GEMINI_API_KEY=YOUR_KEY` even though your `.env` file has the correct key.

## ✅ Solution: Restart the Server

**The server needs to be restarted** to pick up the correct API key from `.env`.

### Steps:

1. **Stop the current server:**
   - Find the terminal where `npm run dev` is running
   - Press `Ctrl + C` to stop it

2. **Remove the system environment variable** (if you haven't already):
   ```powershell
   Remove-Item Env:\GEMINI_API_KEY
   ```

3. **Start the server again:**
   ```bash
   npm run dev
   ```

4. **Test the sentiment analysis:**
   ```bash
   node test-gemini-sentiment.js
   ```

## 🔍 Verify It's Working

After restarting, you should see:
- ✅ SUCCESS!
- Sentiment: POSITIVE (or NEGATIVE/NEUTRAL based on content)
- Confidence scores > 0%
- Proper reasoning explanations
- Is Positive Publicity: ✅ YES or ❌ NO

## 💡 Why This Happens

- Environment variables are loaded when Node.js starts
- System environment variables take precedence over `.env` files by default
- The server caches these values when it starts
- Restarting loads fresh values from `.env`

## 🚀 Permanent Fix

To avoid this issue in the future, remove the system environment variable permanently:

```powershell
# Run PowerShell as Administrator
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $null, 'User')
```

Then restart VS Code/your terminal.
