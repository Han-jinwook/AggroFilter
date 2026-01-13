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

async function testModelFull(modelName) {
  console.log(`\nTesting model: ${modelName}...`);
  try {
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        topP: 0.85,
      }
    });
    
    // Test with a slightly longer prompt to mimic analysis
    const prompt = "Analyze this text for clickbait: 'Shocking news! You won't believe what happened.'";
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log(`✅ ${modelName}: Success!`);
    console.log(`   Response length: ${text.length}`);
    return true;
  } catch (error) {
    console.error(`❌ ${modelName}: Failed!`);
    console.error(`   Error: ${error.message}`);
    if (error.response) {
        console.error(`   Details: ${JSON.stringify(error.response)}`);
    }
    return false;
  }
}

async function runDebug() {
  console.log("=== Gemini API Debug ===");
  
  // 1. Test Pro (Primary)
  const proWorks = await testModelFull("gemini-1.5-pro");
  
  // 2. Test Flash (Fallback)
  const flashWorks = await testModelFull("gemini-1.5-flash");
  
  if (!proWorks && !flashWorks) {
      console.error("\nCRITICAL: Both models failed. Analysis will fail.");
  } else if (!proWorks) {
      console.log("\nWARNING: Primary model failed, but fallback is available. Analysis should work (slower/lower quality).");
  } else {
      console.log("\nSUCCESS: Primary model is working.");
  }
}

runDebug();
