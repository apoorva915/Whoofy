/**
 * External API Services Test/Example
 * 
 * This file demonstrates how to use all external API services
 * Run with: npx tsx src/services/external/__tests__/external-apis.test.ts
 */

import { instagramApi } from '../instagram-api';
import { apifyScraper } from '../apify-scraper';
import { shazamApi } from '../shazam-api';
import { notegptApi } from '../notegpt-api';
import logger from '@/utils/logger';

/**
 * Example: Test Instagram API
 */
async function testInstagramApi() {
  console.log('\n=== Testing Instagram API ===');
  
  try {
    // Get user profile
    const profile = await instagramApi.getUserProfile('test_user');
    console.log('Profile:', profile);
    
    // Get reel metadata
    const reel = await instagramApi.getReelMetadata('https://www.instagram.com/reel/ABC123/');
    console.log('Reel:', reel);
  } catch (error) {
    console.error('Instagram API error:', error);
  }
}

/**
 * Example: Test Apify Scraper
 */
async function testApifyScraper() {
  console.log('\n=== Testing Apify Scraper ===');
  
  try {
    const profile = await apifyScraper.scrapeProfile('test_user');
    console.log('Scraped Profile:', profile);
    
    const reel = await apifyScraper.scrapeReel('https://www.instagram.com/reel/ABC123/');
    console.log('Scraped Reel:', reel);
  } catch (error) {
    console.error('Apify Scraper error:', error);
  }
}

/**
 * Example: Test Shazam API
 */
async function testShazamApi() {
  console.log('\n=== Testing Shazam API ===');
  
  try {
    // Mock audio buffer
    const mockAudio = Buffer.from('mock audio data');
    const result = await shazamApi.recognizeAudio(mockAudio);
    console.log('Shazam Result:', result);
    
    // Or from video URL
    const videoResult = await shazamApi.recognizeFromVideo('https://example.com/video.mp4');
    console.log('Video Shazam Result:', videoResult);
  } catch (error) {
    console.error('Shazam API error:', error);
  }
}

/**
 * Example: Test NoteGPT API
 */
async function testNoteGPTApi() {
  console.log('\n=== Testing NoteGPT API ===');
  
  try {
    const result = await notegptApi.transcribeFromUrl('https://example.com/video.mp4');
    console.log('Transcription:', result);
    
    // Or from buffer
    const mockAudio = Buffer.from('mock audio data');
    const bufferResult = await notegptApi.transcribeFromBuffer(mockAudio);
    console.log('Buffer Transcription:', bufferResult);
  } catch (error) {
    console.error('NoteGPT API error:', error);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Testing External API Services\n');
  
  await testInstagramApi();
  await testApifyScraper();
  await testShazamApi();
  await testNoteGPTApi();
  
  console.log('\n✅ All tests completed!');
}

// Run if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { testInstagramApi, testApifyScraper, testShazamApi, testNoteGPTApi };

