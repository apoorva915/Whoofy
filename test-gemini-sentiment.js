/**
 * Test script for Gemini Sentiment Analysis API
 * Run with: node test-gemini-sentiment.js
 * 
 * Note: Requires Node.js 18+ for built-in fetch, or install node-fetch
 */

// Use node-fetch if fetch is not available (Node < 18)
let fetch;
try {
  fetch = globalThis.fetch || require('node-fetch');
} catch (e) {
  console.error('❌ Error: fetch is not available. Please use Node.js 18+ or install node-fetch: npm install node-fetch');
  process.exit(1);
}

const testData = {
  caption: "#AD ONE product to wake up your skin these winter mornings! 😩🧊 @garnieruk Vitamin C Brightening Serum is the only thing I need to look immediately fresh in seconds this winter! Brightens my complexion, reduces dark spots and instantly wakes up my face 🍊 Shop whilst it's discounted this Black Friday! ❄️ #garnier #blackfriday #skincare",
  transcript: "I am the worst morning person and it's currently three o'clock in the morning. I've got to get up to travel and it is dark and freezing outside. Absolutely no way I'm putting makeup on now, so I'm going to use the Garnier Vitamin C Brightening Serum. When I say this is the best hack to transform your skin, instantly you can see it's brightened my skin and it reduces dark spots. I'm really not a morning person. I always wake up so puffy, so sometimes I just want one product to get me out the door. Face looks immediately awake and super bright and lightweight. And absolutely no makeup needed. And you can grab it discounted this Black Friday."
};

async function testGeminiSentiment() {
  const apiUrl = process.env.API_URL || 'http://localhost:3000/api/sentiment/gemini';
  
  console.log('🧪 Testing Gemini Sentiment Analysis API');
  console.log('📍 Endpoint:', apiUrl);
  console.log('📝 Caption length:', testData.caption.length, 'characters');
  console.log('📝 Transcript length:', testData.transcript.length, 'characters');
  console.log('\n⏳ Sending request...\n');

  try {
    const startTime = Date.now();
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    const result = await response.json();

    console.log('📊 Response Status:', response.status, response.statusText);
    console.log('⏱️  Response Time:', responseTime, 'ms');
    console.log('\n📋 Results:\n');

    if (result.success) {
      console.log('✅ SUCCESS!\n');
      
      console.log('📌 CAPTION ANALYSIS:');
      console.log('   Sentiment:', result.data.caption.sentiment.toUpperCase());
      console.log('   Confidence:', (result.data.caption.confidence * 100).toFixed(1) + '%');
      console.log('   Reasoning:', result.data.caption.reasoning);
      console.log('');
      
      console.log('📌 TRANSCRIPT ANALYSIS:');
      console.log('   Sentiment:', result.data.transcript.sentiment.toUpperCase());
      console.log('   Confidence:', (result.data.transcript.confidence * 100).toFixed(1) + '%');
      console.log('   Reasoning:', result.data.transcript.reasoning);
      console.log('');
      
      console.log('📌 POSITIVE PUBLICITY ASSESSMENT:');
      console.log('   Is Positive Publicity:', result.data.isPositivePublicity ? '✅ YES' : '❌ NO');
      console.log('   Overall Reasoning:', result.data.overallReasoning);
      console.log('');
      
      console.log('⏱️  Processing Time:', result.data.processingTimeMs, 'ms');
      console.log('🕐 Timestamp:', result.timestamp);
    } else {
      console.log('❌ ERROR:', result.error?.code || 'Unknown error');
      console.log('   Message:', result.error?.message);
      if (result.error?.details) {
        console.log('   Details:', result.error.details);
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. The server is running (npm run dev)');
    console.error('   2. The API URL is correct:', apiUrl);
    console.error('   3. GEMINI_API_KEY is set in your .env file');
    process.exit(1);
  }
}

// Run the test
testGeminiSentiment();
