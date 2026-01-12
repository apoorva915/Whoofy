# Quick Start Guide - Gemini Sentiment Analysis

## 🚀 Quick Steps to Test

### 1. Set up API Key
Add to your `.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
Get your key from: https://makersuite.google.com/app/apikey

### 2. Start the Server
```bash
npm run dev
```

### 3. Run the Test Script
In a **new terminal** (keep server running):
```bash
node test-gemini-sentiment.js
```

## ✅ Expected Output

You should see:
```
🧪 Testing Gemini Sentiment Analysis API
📍 Endpoint: http://localhost:3000/api/sentiment/gemini
📝 Caption length: 234 characters
📝 Transcript length: 567 characters

⏳ Sending request...

📊 Response Status: 200 OK
⏱️  Response Time: 1234 ms

📋 Results:

✅ SUCCESS!

📌 CAPTION ANALYSIS:
   Sentiment: POSITIVE
   Confidence: 95.0%
   Reasoning: The caption contains enthusiastic language...

📌 TRANSCRIPT ANALYSIS:
   Sentiment: POSITIVE
   Confidence: 92.0%
   Reasoning: The transcript expresses satisfaction...

📌 POSITIVE PUBLICITY ASSESSMENT:
   Is Positive Publicity: ✅ YES
   Overall Reasoning: This content provides positive publicity...
```

## 🔍 What to Check

- ✅ Server starts without errors
- ✅ Test script runs successfully
- ✅ Response includes `caption.sentiment` and `transcript.sentiment`
- ✅ Both are classified as "positive", "negative", or "neutral"
- ✅ `isPositivePublicity` is a boolean (true/false)
- ✅ Confidence scores are between 0.0 and 1.0

## 🐛 Troubleshooting

**Error: "Gemini API key not configured"**
→ Check your `.env` file has `GEMINI_API_KEY` set

**Error: "Failed to connect"**
→ Make sure server is running (`npm run dev`)

**Error: "fetch is not available"**
→ Use Node.js 18+ or install: `npm install node-fetch`

For more details, see `HOW_TO_TEST.md`
