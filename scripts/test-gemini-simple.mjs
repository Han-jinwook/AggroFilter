import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function testGemini() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  console.log("----------------------------------------");
  console.log("🔍 Gemini API Connection Test");
  console.log("----------------------------------------");
  console.log(`🔑 API Key Found: ${apiKey ? "Yes (" + apiKey.substring(0, 5) + "...)" : "No"}`);

  if (!apiKey) {
    console.error("❌ Error: No API Key provided in .env file.");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemini-1.5-flash";

  try {
    console.log(`🤖 Testing Model: ${modelName}`);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const startTime = Date.now();
    const result = await model.generateContent("Explain 'Quantum Computing' in one sentence.");
    const duration = Date.now() - startTime;
    
    const response = await result.response;
    const text = response.text();

    console.log(`✅ Success! (Took ${duration}ms)`);
    console.log(`📝 Output: ${text}`);
    console.log("----------------------------------------");

  } catch (error) {
    console.error("❌ API Test Failed!");
    console.error("Error Details:", error.message);
    if (error.message.includes("503")) {
      console.error("⚠️  Cause: Service Unavailable (Model Overloaded).");
    } else if (error.message.includes("API key")) {
      console.error("⚠️  Cause: Invalid or Expired API Key.");
    }
    console.log("----------------------------------------");
  }
}

testGemini();
