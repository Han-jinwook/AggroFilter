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
    console.log('Simulating frontend request to http://localhost:3000/api/analysis/request...');
    
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
        console.log('Now fetching the result after a delay...');
        
        // Wait for AI processing
        await new Promise(resolve => setTimeout(resolve, 30000));

        const resultResponse = await fetch(`http://localhost:3000/api/analysis/result/${data.analysisId}`);
        console.log(`\nFetching result from: http://localhost:3000/api/analysis/result/${data.analysisId}`);
        console.log(`Result API Response Status: ${resultResponse.status}`);
        
        const resultData = await resultResponse.json();
        console.log('\n=== FINAL ANALYSIS RESULT ===');
        console.log(JSON.stringify(resultData, null, 2));

        if (!resultResponse.ok) {
            console.error("\n❌ Fetching result failed!");
        }

    } else {
        console.error('\n❌ Analysis request failed.');
    }

  } catch (error) {
    console.error('--- Test Script Error ---');
    console.error(error);
  }
}

runTest();
