import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function testModels() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API Key found");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelsToTest = ["gemini-1.5-pro", "gemini-2.5-pro"];

  for (const modelName of modelsToTest) {
    console.log(`\nTesting model: ${modelName}...`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello.");
      const response = await result.response;
      console.log(`✅ ${modelName} Success: ${response.text().trim().substring(0, 50)}...`);
    } catch (e) {
      console.error(`❌ ${modelName} Failed: ${e.message}`);
    }
  }
}

testModels();
