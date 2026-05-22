import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  console.log("Using API key starting with:", apiKey?.substring(0, 5));
  const ai = new GoogleGenAI({ apiKey });
  
  // Fetch thumbnail
  const thumbUrl = 'https://i.ytimg.com/vi/kHAdm27c97Q/hqdefault.jpg';
  console.log("Fetching image from:", thumbUrl);
  const imgResp = await fetch(thumbUrl);
  const buffer = await imgResp.arrayBuffer();
  const imagePart = {
    inlineData: {
      data: Buffer.from(buffer).toString("base64"),
      mimeType: "image/jpeg"
    }
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      "Who won the latest elections in South Korea? Search the web to find out the current situation.",
      imagePart
    ],
    config: {
      tools: [{ googleSearch: {} }],
    }
  });
  
  console.log("--- Candidate 0 ---");
  const candidate = response.candidates?.[0];
  console.log("Candidate keys:", Object.keys(candidate || {}));
  console.log("GroundingMetadata:", JSON.stringify(candidate?.groundingMetadata, null, 2));
}

run().catch(console.error);
