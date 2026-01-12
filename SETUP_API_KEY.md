# How to Get and Set Up Your Gemini API Key

## 🔑 Step-by-Step Guide

### Step 1: Get Your API Key

1. **Visit Google AI Studio**
   - Go to: https://makersuite.google.com/app/apikey
   - Or: https://aistudio.google.com/app/apikey

2. **Sign In**
   - Use your Google account to sign in

3. **Create API Key**
   - Click "Create API Key" or "Get API Key"
   - If prompted, select an existing Google Cloud project or create a new one
   - The key will be generated automatically

4. **Copy the Key**
   - The key will look like: `AIzaSyB36D4irAF-SrWkjLEgnkQ0LEhfpu8dW1U`
   - It should be approximately **39 characters long**
   - **Important:** Copy it immediately - you won't be able to see it again!

### Step 2: Add to Your .env File

1. **Open your `.env` file** in the project root

2. **Find or add the GEMINI_API_KEY line**
   ```env
   GEMINI_API_KEY=AIzaSyB36D4irAF-SrWkjLEgnkQ0LEhfpu8dW1U
   ```

3. **Important Notes:**
   - Replace `AIzaSyB36D4irAF-SrWkjLEgnkQ0LEhfpu8dW1U` with YOUR actual key
   - Make sure there are NO spaces around the `=`
   - Make sure there's only ONE `GEMINI_API_KEY` line (remove duplicates)
   - Don't use quotes around the key value

### Step 3: Verify Your Key

Run the diagnostic script:
```bash
node check-gemini-key.js
```

You should see:
```
✅ GEMINI_API_KEY found in .env
📝 Key length: 39 characters
📝 Key starts with: AIzaSyB36D...

🧪 Testing API key with Gemini...

✅ API Key is VALID!
📤 Test response: Hello

🎉 Your Gemini API is working correctly!
```

### Step 4: Restart Your Server

After updating `.env`, restart your development server:
```bash
# Stop the current server (Ctrl+C)
npm run dev
```

### Step 5: Test the Sentiment Analysis

```bash
node test-gemini-sentiment.js
```

## 🚨 Common Issues

### Issue: "API key not valid"
**Solution:** 
- Make sure you copied the ENTIRE key (39 characters)
- Check for extra spaces or quotes in `.env`
- Verify you're using the key from Google AI Studio, not a placeholder

### Issue: "Multiple GEMINI_API_KEY entries"
**Solution:**
- Open `.env` file
- Remove all duplicate `GEMINI_API_KEY` lines
- Keep only ONE line with your valid key

### Issue: Key starts with "YOUR_KEY" or similar
**Solution:**
- This is a placeholder, not a real key
- Get a real key from https://makersuite.google.com/app/apikey

### Issue: Key is too short (< 20 characters)
**Solution:**
- Valid Gemini keys are ~39 characters
- Make sure you copied the complete key

## 📋 Example .env File

```env
# Node Environment
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/whoofy?schema=public

# AI Services - Google Gemini
GEMINI_API_KEY=AIzaSyB36D4irAF-SrWkjLEgnkQ0LEhfpu8dW1U

# Other API keys...
```

## 🔒 Security Notes

- **Never commit your `.env` file to Git**
- The `.env` file should be in `.gitignore`
- Keep your API key secret
- If your key is exposed, revoke it and create a new one

## 💰 Pricing

- Google Gemini API has a **free tier** with generous limits
- Check current pricing: https://ai.google.dev/pricing
- Free tier is usually sufficient for development and testing

## ✅ Quick Checklist

- [ ] Got API key from Google AI Studio
- [ ] Key is ~39 characters long
- [ ] Key starts with "AIza..."
- [ ] Added to `.env` file (only ONE entry)
- [ ] No spaces or quotes around the key
- [ ] Ran `node check-gemini-key.js` - shows ✅ VALID
- [ ] Restarted server after updating `.env`
- [ ] Tested with `node test-gemini-sentiment.js`
