const { Pool } = require('pg');
const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    console.error("❌ Error: DATABASE_URL is not defined");
    process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

// Macro Topics to Seed (Korean -> English)
const MACRO_TOPICS = {
    "국제 정세": "International Politics",
    "세계 경제": "Global Economy",
    "자영업": "Self-employment",
    "창업": "Startup",
    "시사 이슈": "Current Affairs",
    "정치": "Politics",
    "외교": "Diplomacy",
    "생활 경제": "Living Economy",
    "경제 뉴스": "Economic News",
    "사회 문제": "Social Issues"
};

async function getEmbedding(text, englishTitle) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
      title: englishTitle // Critical: Use English title
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

async function main() {
    console.log("🚀 Seeding Macro Topics...");
    
    const client = await pool.connect();
    try {
        for (const [ko, en] of Object.entries(MACRO_TOPICS)) {
            // Check if exists
            const exists = await client.query('SELECT id FROM t_topics_master WHERE name_ko = $1', [ko]);
            if (exists.rows.length > 0) {
                console.log(`- Skipping "${ko}" (already exists)`);
                continue;
            }

            // Generate Embedding
            const embedding = await getEmbedding(ko, en);
            if (!embedding) {
                console.error(`❌ Failed embedding for "${ko}"`);
                continue;
            }

            // Insert
            const vectorStr = `[${embedding.join(',')}]`;
            await client.query(
                'INSERT INTO t_topics_master (name_ko, embedding) VALUES ($1, $2)',
                [ko, vectorStr]
            );
            console.log(`✅ Inserted: "${ko}" (En: ${en})`);
            
            // Rate limit
            await new Promise(r => setTimeout(r, 200));
        }

    } finally {
        client.release();
    }
}

main().catch(console.error).finally(() => pool.end());
