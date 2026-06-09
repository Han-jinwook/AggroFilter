const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: 'd:/AggroFilter/.env' });

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function run() {
  console.log('Sending simple prompt to Gemini with googleSearch tool enabled...');
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: '오늘 삼성전자의 종가 또는 주가가 얼마인지 구글 검색을 사용해서 확인하고 답해줘.',
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    console.log('\n--- Text Response ---');
    console.log(response.text);

    console.log('\n--- Full Response Object ---');
    console.log(JSON.stringify(response, null, 2));

    const queries = groundingMetadata?.webSearchQueries ?? [];
    console.log(`\nGrounding Used: ${queries.length > 0}`);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

run();
