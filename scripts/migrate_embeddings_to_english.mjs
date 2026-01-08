import { GoogleGenerativeAI } from "@google/generative-ai";
import pg from 'pg';
import dotenv from 'dotenv';
import https from 'https';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;

// Use DATABASE_URL
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    console.error("❌ Error: DATABASE_URL is not defined");
    process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ Error: API Key not found");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// Helper: Translate Korean topics to English in batch
async function translateTopics(topics) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
    Translate the following Korean topics to English for semantic embedding generation.
    Output ONLY a JSON object where keys are the Korean topics and values are the English translations.
    Do not use markdown.
    
    Topics:
    ${topics.map(t => t.name_ko).join("\n")}
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json|\n```|```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Translation Error:", e);
        return {};
    }
}

// Helper: Generate embedding using English title strategy
async function getEmbedding(koreanText, englishTitle) {
  return new Promise((resolve) => {
    if (!koreanText || !englishTitle) {
        resolve(null);
        return;
    }

    const postData = JSON.stringify({
      content: { parts: [{ text: koreanText }] },
      taskType: "RETRIEVAL_DOCUMENT",
      title: englishTitle // Use English translation as title
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const response = JSON.parse(body);
                resolve(response.embedding.values);
            } catch (e) { resolve(null); }
        } else {
          console.error(`Embedding Error ${res.statusCode}: ${body}`);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

async function migrate() {
  console.log("🚀 Starting Migration to English Semantic Embeddings...");
  
  const client = await pool.connect();
  try {
    // 1. Fetch all topics
    const res = await client.query('SELECT id, name_ko FROM t_topics_master ORDER BY id ASC');
    const topics = res.rows;
    console.log(`Found ${topics.length} topics.`);

    // 2. Process in chunks of 50 for translation
    const CHUNK_SIZE = 50;
    let successCount = 0;

    for (let i = 0; i < topics.length; i += CHUNK_SIZE) {
        const chunk = topics.slice(i, i + CHUNK_SIZE);
        console.log(`\nProcessing chunk ${i/CHUNK_SIZE + 1} (${chunk.length} items)...`);

        // Translate
        const translations = await translateTopics(chunk);
        
        // Update Embeddings
        for (const topic of chunk) {
            const englishTitle = translations[topic.name_ko];
            if (!englishTitle) {
                console.warn(`   ⚠️ No translation for "${topic.name_ko}", skipping.`);
                continue;
            }

            const embedding = await getEmbedding(topic.name_ko, englishTitle);
            if (embedding) {
                const vectorStr = `[${embedding.join(',')}]`;
                await client.query(
                    'UPDATE t_topics_master SET embedding = $1 WHERE id = $2',
                    [vectorStr, topic.id]
                );
                process.stdout.write(".");
                successCount++;
            } else {
                console.warn(`   ❌ Embedding failed for "${topic.name_ko}"`);
            }
            
            // Rate limit
            await new Promise(r => setTimeout(r, 100));
        }
    }

    console.log(`\n\n✨ Migration Complete! Updated ${successCount}/${topics.length} topics.`);

  } catch (err) {
    console.error("Fatal Error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
