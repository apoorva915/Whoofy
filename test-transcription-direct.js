/**
 * Test OpenAI Transcription API directly
 * This tests if the file upload works outside of Next.js
 */

require('dotenv').config();
const OpenAI = require('openai').default;
const fs = require('fs');
const path = require('path');

async function testTranscription() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found');
    return;
  }
  
  const client = new OpenAI({
    apiKey: apiKey,
    timeout: 300000,
  });
  
  // Find a test audio file
  const audioDir = path.join(process.cwd(), 'storage', 'temp');
  const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3'));
  
  if (files.length === 0) {
    console.log('❌ No audio files found in storage/temp');
    console.log('   Please run a transcription first to generate an audio file');
    return;
  }
  
  const testFile = path.join(audioDir, files[0]);
  console.log(`🧪 Testing transcription with: ${testFile}`);
  console.log(`   Size: ${(fs.statSync(testFile).size / 1024).toFixed(2)} KB\n`);
  
  try {
    // Read as buffer and create File
    const buffer = fs.readFileSync(testFile);
    const fileName = path.basename(testFile);
    
    let file;
    if (typeof File !== 'undefined') {
      file = new File([buffer], fileName, { type: 'audio/mpeg' });
      console.log('✅ Using File API');
    } else {
      // Use ReadStream
      const fileStream = fs.createReadStream(testFile);
      fileStream.name = fileName;
      file = fileStream;
      console.log('✅ Using ReadStream');
    }
    
    console.log('\n📤 Sending to OpenAI API...');
    const startTime = Date.now();
    
    const transcription = await client.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: undefined, // auto-detect
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Transcription successful! (${duration}ms)`);
    console.log(`   Language: ${transcription.language || 'unknown'}`);
    console.log(`   Text length: ${transcription.text.length} characters`);
    console.log(`   Segments: ${transcription.segments?.length || 0}`);
    console.log(`\n📝 Transcript preview:`);
    console.log(`   ${transcription.text.substring(0, 200)}...`);
    
  } catch (error) {
    console.error('\n❌ Transcription failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error(`   Status: ${error.status}`);
    if (error.response) {
      console.error(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
    console.error(`\n   Stack: ${error.stack?.substring(0, 500)}`);
  }
}

testTranscription().catch(console.error);



