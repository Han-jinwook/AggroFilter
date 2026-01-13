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

// REST API call to list models
async function listModels() {
  try {
    console.log("Fetching available models via REST API...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (!response.ok) {
        console.error(`HTTP Error: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error("Response body:", text);
        return;
    }

    const data = await response.json();
    
    if (data.models) {
        console.log("\n=== Available Models ===");
        data.models.forEach(m => {
            // Filter for generateContent supported models
            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                 console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
            }
        });
        console.log("========================\n");
    } else {
        console.error("Failed to list models:", data);
    }
    
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
