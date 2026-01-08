import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import https from 'https';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API Key found");
    process.exit(1);
}

console.log(`Checking models for API Key: ${apiKey.substring(0, 5)}...`);

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models?key=${apiKey}`,
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const response = JSON.parse(body);
                console.log("Available Models:");
                if (response.models) {
                    response.models.forEach(model => {
                        console.log(`- ${model.name} (${model.supportedGenerationMethods.join(', ')})`);
                    });
                } else {
                    console.log("No models found in response.");
                }
            } catch (e) {
                console.error("Error parsing JSON:", e);
                console.log("Raw Body:", body);
            }
        } else {
            console.error(`API Error ${res.statusCode}: ${body}`);
        }
    });
});

req.on('error', (e) => {
    console.error("Network Error:", e);
});

req.end();
