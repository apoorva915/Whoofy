# Fix System Environment Variable Issue

## ⚠️ Important: System Environment Variable Override

Your system has a `GEMINI_API_KEY` environment variable set to `YOUR_KEY` which is overriding your `.env` file.

## 🔧 How to Fix Permanently

### Option 1: Remove System Environment Variable (Recommended)

**Windows PowerShell (Run as Administrator):**
```powershell
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $null, 'User')
```

**Or via System Settings:**
1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Go to "Advanced" tab
3. Click "Environment Variables"
4. Under "User variables", find `GEMINI_API_KEY`
5. Select it and click "Delete"
6. Click OK

### Option 2: Use .env File Only (Temporary Fix)

For your current terminal session, run:
```powershell
Remove-Item Env:\GEMINI_API_KEY
```

Then start your server:
```powershell
npm run dev
```

**Note:** This only works for the current terminal session. You'll need to do this each time you open a new terminal.

### Option 3: Update System Variable to Correct Value

If you want to keep using system environment variables:
```powershell
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'AIzaSyB36D4irAF-SrWkjLEgnkQ0LEhfpu8dW1U', 'User')
```

## ✅ Verification

After fixing, verify it works:
```bash
node check-gemini-key.js
```

You should see:
```
✅ API Key is VALID!
🎉 Your Gemini API is working correctly!
```

## 🚀 Next Steps

1. Fix the environment variable (use Option 1 for permanent fix)
2. Restart your terminal/VS Code
3. Start your server: `npm run dev`
4. Test sentiment analysis: `node test-gemini-sentiment.js`
