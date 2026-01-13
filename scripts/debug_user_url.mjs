import { analyzeContent } from '../lib/gemini.ts';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const testUrl = 'https://youtu.be/XrU3xWoMuWE';

async function runTest() {
  console.log(`--- Running Full Analysis Test for: ${testUrl} ---`);
  
  try {
    // This won't work directly due to TS/JS module issues and path aliases.
    // We need to replicate the core logic of analyzeContent here.
    
    // Replicating the core logic from lib/gemini.ts
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const { extractVideoId, getVideoInfo, getTranscript } = await import('../lib/youtube.ts');

    const videoId = extractVideoId(testUrl);
    if (!videoId) {
        console.error("Invalid YouTube URL");
        return;
    }

    const videoInfo = await getVideoInfo(videoId);
    const transcript = await getTranscript(videoId);

    console.log(`Video Info: ${videoInfo.title}`);
    console.log(`Transcript Length: ${transcript.length}`);

    // Directly call analyzeContent logic here if possible, or replicate it.
    // Since we can't easily import analyzeContent due to module resolution,
    // we will just confirm that the models are accessible and the API key is working.
    // The previous script already did this. Let's try to call analyzeContent directly
    // assuming the environment can handle it (e.g. using tsx or similar).
    
    // Let's try a direct call to the API endpoint instead to simulate the frontend.
    const response = await fetch('http://localhost:3000/api/analysis/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl })
    });

    console.log(`API Response Status: ${response.status}`);
    const data = await response.json();
    console.log('API Response Data:', data);

    if (response.ok && data.analysisId) {
        console.log(`\n✅ Analysis request successful. Result ID: ${data.analysisId}`);
        console.log('Now fetching the result...');
        
        // Wait a bit for analysis to complete
        await new Promise(resolve => setTimeout(resolve, 15000));

        const resultResponse = await fetch(`http://localhost:3000/api/analysis/result/${data.analysisId}`);
        const resultData = await resultResponse.json();
        console.log('\n=== FINAL ANALYSIS RESULT ===');
        console.log(JSON.stringify(resultData, null, 2));
    } else {
        console.error('\n❌ Analysis request failed.');
    }

  } catch (error) {
    console.error('--- Test Script Error ---');
    console.error(error);
  }
}

runTest();
