# Gemini Sentiment Analysis API Usage

This document explains how to use the Gemini sentiment analysis API endpoint to analyze captions and transcripts scraped by Apify.

## Endpoint

`POST /api/sentiment/gemini`

## Request Body

```json
{
  "caption": "Your caption text here (optional)",
  "transcript": "Your transcript text here (optional)"
}
```

**Note:** At least one of `caption` or `transcript` must be provided.

## Response

```json
{
  "success": true,
  "data": {
    "caption": {
      "sentiment": "positive|negative|neutral",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation of the sentiment"
    },
    "transcript": {
      "sentiment": "positive|negative|neutral",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation of the sentiment"
    },
    "isPositivePublicity": true|false,
    "overallReasoning": "Detailed explanation of why this is or isn't positive publicity",
    "processingTimeMs": 1234
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Example Usage

### Using cURL

```bash
curl -X POST http://localhost:3000/api/sentiment/gemini \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "#AD ONE product to wake up your skin these winter mornings! 😩🧊 @garnieruk Vitamin C Brightening Serum is the only thing I need to look immediately fresh in seconds this winter! Brightens my complexion, reduces dark spots and instantly wakes up my face 🍊 Shop whilst it'\''s discounted this Black Friday! ❄️ #garnier #blackfriday #skincare",
    "transcript": "I am the worst morning person and it'\''s currently three o'\''clock in the morning. I'\''ve got to get up to travel and it is dark and freezing outside. Absolutely no way I'\''m putting makeup on now, so I'\''m going to use the Garnier Vitamin C Brightening Serum. When I say this is the best hack to transform your skin, instantly you can see it'\''s brightened my skin and it reduces dark spots. I'\''m really not a morning person. I always wake up so puffy, so sometimes I just want one product to get me out the door. Face looks immediately awake and super bright and lightweight. And absolutely no makeup needed. And you can grab it discounted this Black Friday."
  }'
```

### Using JavaScript/TypeScript

```typescript
const response = await fetch('http://localhost:3000/api/sentiment/gemini', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    caption: "#AD ONE product to wake up your skin these winter mornings! 😩🧊 @garnieruk Vitamin C Brightening Serum is the only thing I need to look immediately fresh in seconds this winter! Brightens my complexion, reduces dark spots and instantly wakes up my face 🍊 Shop whilst it's discounted this Black Friday! ❄️ #garnier #blackfriday #skincare",
    transcript: "I am the worst morning person and it's currently three o'clock in the morning. I've got to get up to travel and it is dark and freezing outside. Absolutely no way I'm putting makeup on now, so I'm going to use the Garnier Vitamin C Brightening Serum. When I say this is the best hack to transform your skin, instantly you can see it's brightened my skin and it reduces dark spots. I'm really not a morning person. I always wake up so puffy, so sometimes I just want one product to get me out the door. Face looks immediately awake and super bright and lightweight. And absolutely no makeup needed. And you can grab it discounted this Black Friday."
  }),
});

const result = await response.json();
console.log('Caption Sentiment:', result.data.caption.sentiment);
console.log('Transcript Sentiment:', result.data.transcript.sentiment);
console.log('Is Positive Publicity:', result.data.isPositivePublicity);
```

### Using Python

```python
import requests
import json

url = "http://localhost:3000/api/sentiment/gemini"
payload = {
    "caption": "#AD ONE product to wake up your skin these winter mornings! 😩🧊 @garnieruk Vitamin C Brightening Serum is the only thing I need to look immediately fresh in seconds this winter! Brightens my complexion, reduces dark spots and instantly wakes up my face 🍊 Shop whilst it's discounted this Black Friday! ❄️ #garnier #blackfriday #skincare",
    "transcript": "I am the worst morning person and it's currently three o'clock in the morning. I've got to get up to travel and it is dark and freezing outside. Absolutely no way I'm putting makeup on now, so I'm going to use the Garnier Vitamin C Brightening Serum. When I say this is the best hack to transform your skin, instantly you can see it's brightened my skin and it reduces dark spots. I'm really not a morning person. I always wake up so puffy, so sometimes I just want one product to get me out the door. Face looks immediately awake and super bright and lightweight. And absolutely no makeup needed. And you can grab it discounted this Black Friday."
}

response = requests.post(url, json=payload)
result = response.json()

print(f"Caption Sentiment: {result['data']['caption']['sentiment']}")
print(f"Transcript Sentiment: {result['data']['transcript']['sentiment']}")
print(f"Is Positive Publicity: {result['data']['isPositivePublicity']}")
```

## Integration with Apify Data

If you're using Apify to scrape Instagram reels, you can pass the `caption` and `transcript` fields directly:

```typescript
// Assuming you have Apify scraped data
const apifyData = await apifyScraper.scrapeReel(reelUrl);

const sentimentResult = await fetch('http://localhost:3000/api/sentiment/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    caption: apifyData.caption,
    transcript: apifyData.transcript,
  }),
});

const analysis = await sentimentResult.json();
```

## Environment Setup

Make sure you have the `GEMINI_API_KEY` environment variable set in your `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

You can get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

## Error Handling

If the API key is not configured or there's an error, the endpoint will return:

```json
{
  "success": false,
  "error": {
    "code": "SENTIMENT_ANALYSIS_ERROR",
    "message": "Error message here"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Features

- **Separate Analysis**: Analyzes caption and transcript separately
- **Confidence Scores**: Provides confidence scores (0.0-1.0) for each sentiment analysis
- **Reasoning**: Includes detailed reasoning for each sentiment classification
- **Positive Publicity Assessment**: Determines if the content provides positive publicity overall
- **Comprehensive Analysis**: Uses Google's Gemini AI for advanced sentiment understanding
