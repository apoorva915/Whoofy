/**
 * Direct test of Gemini API using REST API
 */
require('dotenv').config();

async function testDirect() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ No API key found');
    process.exit(1);
  }
  
  console.log('🧪 Testing Gemini API directly with REST...\n');
  
  // Try v1 API endpoint
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [{
        text: 'Say "Hello" in one word.'
      }]
    }]
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log('✅ SUCCESS with v1 API!');
      console.log('📤 Response:', text);
      console.log('\n💡 Use model name: gemini-pro');
    } else {
      console.log('❌ v1 API Error:', JSON.stringify(result, null, 2));
      
      // Try v1beta
      console.log('\n🔄 Trying v1beta API...');
      const urlBeta = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const responseBeta = await fetch(urlBeta, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const resultBeta = await responseBeta.json();
      
      if (responseBeta.ok) {
        const text = resultBeta.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('✅ SUCCESS with v1beta API!');
        console.log('📤 Response:', text);
        console.log('\n💡 Use model name: gemini-1.5-flash');
      } else {
        console.log('❌ v1beta API Error:', JSON.stringify(resultBeta, null, 2));
      }
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

testDirect();
