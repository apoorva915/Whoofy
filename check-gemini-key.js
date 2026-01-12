/**
 * Script to check if Gemini API key is valid
 * Run with: node check-gemini-key.js
 */

require('dotenv').config();

async function checkGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  console.log('🔍 Checking Gemini API Key Configuration\n');
  
  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY is not set in .env file');
    console.log('💡 Get your API key from: https://makersuite.google.com/app/apikey');
    console.log('💡 Add it to your .env file: GEMINI_API_KEY=your_key_here');
    process.exit(1);
  }
  
  // Check for duplicate keys
  const envContent = require('fs').readFileSync('.env', 'utf8');
  const keyMatches = envContent.match(/GEMINI_API_KEY=/g);
  if (keyMatches && keyMatches.length > 1) {
    console.log('⚠️  WARNING: Multiple GEMINI_API_KEY entries found in .env file');
    console.log('   Only the last one will be used. Remove duplicates!\n');
  }
  
  console.log('✅ GEMINI_API_KEY found in .env');
  console.log('📝 Key length:', apiKey.length, 'characters');
  console.log('📝 Key starts with:', apiKey.substring(0, 10) + '...');
  
  // Check if it's a placeholder
  const placeholderPatterns = ['YOUR_KEY', 'your_key', 'your_api_key', 'placeholder', 'example'];
  const isPlaceholder = placeholderPatterns.some(pattern => 
    apiKey.toLowerCase().includes(pattern.toLowerCase())
  );
  
  if (isPlaceholder || apiKey.length < 20) {
    console.log('\n⚠️  WARNING: This looks like a placeholder or invalid key!');
    console.log('   Valid Gemini API keys are typically 39 characters long');
    console.log('   and start with "AIza..."');
    console.log('\n💡 Get a real API key from: https://makersuite.google.com/app/apikey\n');
  }
  
  console.log('\n🧪 Testing API key with Gemini...\n');
  
  try {
    const { GoogleGenAI } = require('@google/genai');
    const client = new GoogleGenAI({ apiKey });
    
    // Try a simple API call
    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Say "Hello" in one word.' }] }],
    });
    
    if (result.error) {
      console.log('❌ API Error:', JSON.stringify(result.error, null, 2));
      console.log('\n💡 Possible issues:');
      console.log('   1. API key is invalid or expired');
      console.log('   2. API key doesn\'t have proper permissions');
      console.log('   3. Get a new key from: https://makersuite.google.com/app/apikey');
      process.exit(1);
    }
    
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (text) {
      console.log('✅ API Key is VALID!');
      console.log('📤 Test response:', text);
      console.log('\n🎉 Your Gemini API is working correctly!');
    } else {
      console.log('⚠️  API call succeeded but got empty response');
      console.log('Full response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.log('❌ Error testing API key:', error.message);
    console.log('\n💡 Possible issues:');
    console.log('   1. API key is invalid or expired');
    console.log('   2. Network connection issue');
    console.log('   3. Get a new key from: https://makersuite.google.com/app/apikey');
    console.log('\nFull error:', error);
    process.exit(1);
  }
}

checkGeminiKey();
