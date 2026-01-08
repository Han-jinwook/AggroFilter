const { Pool } = require('pg');
const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Use DATABASE_URL as per project standard
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    console.error("❌ Error: DATABASE_URL is not defined in environment variables");
    process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

// Manual Translations for debugging
const TRANSLATIONS = {
    "국제 정세": "International Politics",
    "미국 베네수엘라": "US Venezuela Relations",
    "블록체인 기술": "Blockchain Technology",
    "외교 정책": "Foreign Policy",
    "경제 제재": "Economic Sanctions"
};

async function getEmbedding(text, englishTitle) {
  return new Promise((resolve) => {
    if (!text || text.trim() === '') {
        resolve(null);
        return;
    }

    // Use English Title for embedding generation
    const title = englishTitle || text;
    console.log(`   (Using Title: "${title}")`);

    const postData = JSON.stringify({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
      title: title
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
          console.log(`Error ${res.statusCode}: ${body}`);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

async function checkTopicMatch(inputTopic) {
    console.log(`\n🔎 Testing Input: "${inputTopic}"`);
    
    const englishTitle = TRANSLATIONS[inputTopic] || inputTopic;
    
    // 1. Generate Embedding (Using English Title)
    const embedding = await getEmbedding(inputTopic, englishTitle);
    if (!embedding) {
        console.log("❌ Failed to generate embedding");
        return;
    }

    // 2. Find Closest Match in DB
    const client = await pool.connect();
    try {
        const vectorStr = `[${embedding.join(',')}]`;
        const res = await client.query(`
            SELECT name_ko, (embedding <=> $1) as distance
            FROM t_topics_master
            ORDER BY embedding <=> $1
            LIMIT 5
        `, [vectorStr]);

        console.log("🏆 Top 5 Matches:");
        res.rows.forEach((row, i) => {
            const similarity = (1 - row.distance).toFixed(4);
            console.log(`   ${i + 1}. "${row.name_ko}" (Sim: ${similarity})`);
        });

        // Check distance to "Blockchain" specifically
        const blockRes = await client.query(`
            SELECT name_ko, (embedding <=> $1) as distance
            FROM t_topics_master
            WHERE name_ko = '블록체인 기술'
        `, [vectorStr]);
        
        if (blockRes.rows.length > 0) {
             const sim = (1 - blockRes.rows[0].distance).toFixed(4);
             console.log(`\n⚠️ Distance to "블록체인 기술": ${sim}`);
        }

    } finally {
        client.release();
    }
}

async function main() {
    console.log("🚀 Debugging 'Venezuela' -> 'International Politics' Match...");
    
    // Check if the new topics are effective
    await checkTopicMatch("국제 정세");
    await checkTopicMatch("미국 베네수엘라");
    await checkTopicMatch("경제 제재");
}

main().catch(console.error).finally(() => pool.end());
