import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function listModels() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API Key found");
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to access client? No, need separate call.
    // Actually the SDK doesn't expose listModels directly on the main class easily in some versions.
    // But let's try the fetch approach if the SDK doesn't help, or just try known valid names.
    
    // Attempting to run a simple generation with a known older model to verify key at least.
    console.log("Testing gemini-pro...");
    const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
    await modelPro.generateContent("test");
    console.log("gemini-pro works.");

    console.log("Testing gemini-1.5-flash-001...");
    const modelFlash001 = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
    await modelFlash001.generateContent("test");
    console.log("gemini-1.5-flash-001 works.");
    
    console.log("Testing gemini-1.5-flash...");
    const modelFlash = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    await modelFlash.generateContent("test");
    console.log("gemini-1.5-flash works.");

  } catch (e) {
    console.error("Error testing models:", e.message);
  }
}

listModels();
