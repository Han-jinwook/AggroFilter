
require('dotenv').config();
const { analyzeContent } = require('../lib/gemini');

async function testDirect() {
  console.log('Testing analyzeContent directly...');
  try {
    const result = await analyzeContent(
      'Rick Astley',
      'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)',
      'We\'re no strangers to love. You know the rules and so do I...',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    );
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Direct Test Error:', error);
  }
}

testDirect();
