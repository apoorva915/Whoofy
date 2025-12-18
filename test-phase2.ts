/**
 * Phase 2 Testing Script
 * 
 * Run with: npx tsx test-phase2.ts
 * 
 * This script tests all Phase 2 external API services.
 * Works with or without API keys (uses mock data if keys not configured).
 */

import { externalApiService } from './src/services/external';
import { instagramApi, apifyScraper, shazamApi, notegptApi } from './src/services/external';

async function testPhase2() {
  console.log('🧪 Testing Phase 2: External API Integrations\n');
  console.log('=' .repeat(60));

  // Check API configuration
  console.log('\n📋 API Configuration Status:');
  console.log(`  Instagram API: ${instagramApi.isConfigured() ? '✅ Configured' : '⚠️  Using Mock Data'}`);
  console.log(`  Apify Scraper: ${apifyScraper.isConfigured() ? '✅ Configured' : '⚠️  Using Mock Data'}`);
  console.log(`  Shazam API: ${shazamApi.isConfigured() ? '✅ Configured' : '⚠️  Using Mock Data'}`);
  console.log(`  NoteGPT API: ${notegptApi.isConfigured() ? '✅ Configured' : '⚠️  Using Mock Data'}`);

  console.log('\n' + '='.repeat(60));
  console.log('\n🚀 Testing Services...\n');

  try {
    // Test 1: Instagram Profile
    console.log('1️⃣  Testing Instagram Profile...');
    const profile = await externalApiService.getInstagramProfile('testuser');
    console.log('   ✅ Success!');
    console.log(`   Username: ${profile.username}`);
    console.log(`   Followers: ${profile.followersCount.toLocaleString()}`);
    console.log(`   Verified: ${profile.isVerified ? 'Yes' : 'No'}`);

    // Test 2: Instagram Reel
    console.log('\n2️⃣  Testing Instagram Reel Metadata...');
    const reel = await externalApiService.getInstagramReel('https://instagram.com/reel/abc123/');
    console.log('   ✅ Success!');
    console.log(`   Reel ID: ${reel.id}`);
    console.log(`   Likes: ${reel.likeCount.toLocaleString()}`);
    console.log(`   Comments: ${reel.commentCount.toLocaleString()}`);
    console.log(`   Caption: ${reel.caption?.substring(0, 50)}...`);

    // Test 3: Video Transcription
    console.log('\n3️⃣  Testing Video Transcription...');
    const transcript = await externalApiService.transcribeVideo('https://example.com/video.mp4');
    console.log('   ✅ Success!');
    console.log(`   Language: ${transcript.language}`);
    console.log(`   Transcript: ${transcript.transcript.substring(0, 100)}...`);
    console.log(`   Segments: ${transcript.segments.length}`);
    console.log(`   Processing Time: ${transcript.processingTimeMs}ms`);

    // Test 4: Audio Recognition
    console.log('\n4️⃣  Testing Audio Recognition...');
    const audio = await externalApiService.recognizeAudio('https://example.com/video.mp4');
    console.log('   ✅ Success!');
    if (audio.track) {
      console.log(`   Track: ${audio.track.title}`);
      console.log(`   Artist: ${audio.track.artist}`);
      console.log(`   Confidence: ${(audio.confidence * 100).toFixed(1)}%`);
    } else {
      console.log('   No track recognized');
    }
    console.log(`   Processing Time: ${audio.processingTimeMs}ms`);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All Phase 2 tests passed successfully!');
    console.log('\n💡 Tip: Add API keys to .env file to use real data instead of mock data.');
    console.log('   See docs/PHASE2_SETUP_GUIDE.md for instructions.\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testPhase2().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});







