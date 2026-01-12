# How to Run and Test Gemini Sentiment Analysis

## Prerequisites

1. **Set up your Gemini API Key**
   - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Add it to your `.env` file:
     ```env
     GEMINI_API_KEY=your_api_key_here
     ```

## Step 1: Start the Development Server

Open a terminal and run:

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port shown in the terminal).

## Step 2: Test the API

You have several options to test:

### Option A: Using the Test Script (Easiest)

```bash
node test-gemini-sentiment.js
```

This will automatically test the API with sample data from your image.

### Option B: Using cURL

Open a new terminal (keep the server running) and run:

```bash
curl -X POST http://localhost:3000/api/sentiment/gemini ^
  -H "Content-Type: application/json" ^
  -d "{\"caption\":\"#AD ONE product to wake up your skin these winter mornings! 😩🧊 @garnieruk Vitamin C Brightening Serum is the only thing I need to look immediately fresh in seconds this winter! Brightens my complexion, reduces dark spots and instantly wakes up my face 🍊 Shop whilst it's discounted this Black Friday! ❄️ #garnier #blackfriday #skincare\",\"transcript\":\"I am the worst morning person and it's currently three o'clock in the morning. I've got to get up to travel and it is dark and freezing outside. Absolutely no way I'm putting makeup on now, so I'm going to use the Garnier Vitamin C Brightening Serum. When I say this is the best hack to transform your skin, instantly you can see it's brightened my skin and it reduces dark spots. I'm really not a morning person. I always wake up so puffy, so sometimes I just want one product to get me out the door. Face looks immediately awake and super bright and lightweight. And absolutely no makeup needed. And you can grab it discounted this Black Friday.\"}"
```

**Note:** On Windows PowerShell, use backticks for line continuation:
```powershell
curl -X POST http://localhost:3000/api/sentiment/gemini `
  -H "Content-Type: application/json" `
  -d '{\"caption\":\"#AD ONE product...\",\"transcript\":\"I am the worst morning person...\"}'
```

### Option C: Using a REST Client (Postman, Insomnia, etc.)

1. **Method:** POST
2. **URL:** `http://localhost:3000/api/sentiment/gemini`
3. **Headers:**
   - `Content-Type: application/json`
4. **Body (JSON):**
   ```json
   {
     "caption": "#AD ONE product to wake up your skin these winter mornings! 😩🧊 @garnieruk Vitamin C Brightening Serum is the only thing I need to look immediately fresh in seconds this winter! Brightens my complexion, reduces dark spots and instantly wakes up my face 🍊 Shop whilst it's discounted this Black Friday! ❄️ #garnier #blackfriday #skincare",
     "transcript": "I am the worst morning person and it's currently three o'clock in the morning. I've got to get up to travel and it is dark and freezing outside. Absolutely no way I'm putting makeup on now, so I'm going to use the Garnier Vitamin C Brightening Serum. When I say this is the best hack to transform your skin, instantly you can see it's brightened my skin and it reduces dark spots. I'm really not a morning person. I always wake up so puffy, so sometimes I just want one product to get me out the door. Face looks immediately awake and super bright and lightweight. And absolutely no makeup needed. And you can grab it discounted this Black Friday."
   }
   ```

### Option D: Using Browser Console (JavaScript)

Open your browser's developer console (F12) and run:

```javascript
fetch('http://localhost:3000/api/sentiment/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    caption: "#AD ONE product to wake up your skin these winter mornings! 😩🧊 @garnieruk Vitamin C Brightening Serum is the only thing I need to look immediately fresh in seconds this winter! Brightens my complexion, reduces dark spots and instantly wakes up my face 🍊 Shop whilst it's discounted this Black Friday! ❄️ #garnier #blackfriday #skincare",
    transcript: "I am the worst morning person and it's currently three o'clock in the morning. I've got to get up to travel and it is dark and freezing outside. Absolutely no way I'm putting makeup on now, so I'm going to use the Garnier Vitamin C Brightening Serum. When I say this is the best hack to transform your skin, instantly you can see it's brightened my skin and it reduces dark spots. I'm really not a morning person. I always wake up so puffy, so sometimes I just want one product to get me out the door. Face looks immediately awake and super bright and lightweight. And absolutely no makeup needed. And you can grab it discounted this Black Friday."
  })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Success:', data.success);
  console.log('Caption Sentiment:', data.data.caption.sentiment);
  console.log('Transcript Sentiment:', data.data.transcript.sentiment);
  console.log('Is Positive Publicity:', data.data.isPositivePublicity);
  console.log('Full Response:', data);
});
```

## Expected Response

```json
{
  "success": true,
  "data": {
    "caption": {
      "sentiment": "positive",
      "confidence": 0.95,
      "reasoning": "The caption contains enthusiastic language, positive emojis, and clear product endorsement..."
    },
    "transcript": {
      "sentiment": "positive",
      "confidence": 0.92,
      "reasoning": "The transcript expresses satisfaction with the product and recommends it..."
    },
    "isPositivePublicity": true,
    "overallReasoning": "This content provides positive publicity as it enthusiastically promotes the product...",
    "processingTimeMs": 1234
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Troubleshooting

### Error: "Gemini API key not configured"
- Make sure you have `GEMINI_API_KEY` in your `.env` file
- Restart the development server after adding the key

### Error: "Failed to connect"
- Make sure the server is running (`npm run dev`)
- Check that the port is correct (default: 3000)

### Error: "Invalid request"
- Make sure you're sending JSON with at least one of `caption` or `transcript`
- Check that Content-Type header is set to `application/json`

### Error: "SENTIMENT_ANALYSIS_ERROR"
- Check the server logs for detailed error messages
- Verify your Gemini API key is valid
- Check your internet connection

## Quick Test Checklist

- [ ] Server is running (`npm run dev`)
- [ ] `.env` file has `GEMINI_API_KEY` set
- [ ] Test script runs successfully (`node test-gemini-sentiment.js`)
- [ ] Response includes `caption.sentiment` and `transcript.sentiment`
- [ ] Response includes `isPositivePublicity` boolean
- [ ] Both sentiments are classified correctly

## Next Steps

Once testing is successful, you can:
1. Integrate this API endpoint with your Apify scraper
2. Use it in your verification workflow
3. Store results in your database
4. Build a UI to display sentiment analysis results
