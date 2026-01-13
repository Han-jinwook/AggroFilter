import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("API Key not found!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName) {
  console.log(`Testing model: ${modelName}...`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hello, are you working?");
    const response = await result.response;
    console.log(`✅ ${modelName}: Success! Response: ${response.text().trim()}`);
    return true;
  } catch (error) {
    console.error(`❌ ${modelName}: Failed! Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  // Test Gemini 2.0 Flash (Stable?)
  await testModel("gemini-2.0-flash");
  
  // Test Gemini 2.0 Flash Lite
  await testModel("gemini-2.0-flash-lite");
}

runTests();
