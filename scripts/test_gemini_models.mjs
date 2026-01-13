import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
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
    const result = await model.generateContent("Hello, world!");
    const response = await result.response;
    console.log(`✅ ${modelName}: Success! Response: ${response.text().trim()}`);
    return true;
  } catch (error) {
    console.error(`❌ ${modelName}: Failed! Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log("Starting Model Availability Tests...");
  
  // 1. Primary: gemini-1.5-pro (High Quality, Low Rate Limit)
  await testModel("gemini-1.5-pro");
  
  // 2. Fallback: gemini-1.5-flash (High Speed, Higher Rate Limit)
  await testModel("gemini-1.5-flash");
  
  // 3. Experimental: gemini-2.0-flash-exp (Just in case)
  await testModel("gemini-2.0-flash-exp");
}

runTests();
