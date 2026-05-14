import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// .env 파일 로드
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("API Key not found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    console.log("Checking available models for your API Key...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        console.error(`HTTP Error: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error("Response body:", text);
        return;
    }

    const data = await response.json();
    
    if (data.models) {
        console.log("\n=== Available Models ===");
        const generateModels = data.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
        
        if (generateModels.length === 0) {
            console.log("No models found that support 'generateContent'.");
        }

        generateModels.forEach(m => {
            console.log(`- ${m.name.replace('models/', '')}`);
        });
        console.log("========================\n");
    } else {
        console.error("No 'models' field in response:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

listModels();
