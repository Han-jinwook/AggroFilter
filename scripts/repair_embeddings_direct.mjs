import dotenv from 'dotenv';
import pg from 'pg';
import https from 'https';

// Load env vars
dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

// Use DATABASE_URL as per lib/db.ts
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not defined in .env or .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, // Assume SSL is needed for cloud DBs, safe for most
});

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ Error: API Key not found");
    process.exit(1);
}

// Romanization Logic (Inlined for standalone script usage)
const CHO = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', 'ng', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
];
const JUNG = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
];
const JONG = [
  '', 'k', 'kk', 'ks', 'n', 'nj', 'nh', 'd', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'
];

function romanize(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode >= 0xAC00 && charCode <= 0xD7A3) {
      const code = charCode - 0xAC00;
      const jong = code % 28;
      const jung = ((code - jong) / 28) % 21;
      const cho = Math.floor((code - jong) / 28 / 21);
      result += CHO[cho] + JUNG[jung] + JONG[jong];
    } else {
      result += text[i];
    }
  }
  return result;
}

// REST-based embedding function (Fixed encoding using native https + Romanized Title)
async function getEmbedding(text) {
  return new Promise((resolve) => {
    // Ensure text is clean
    if (!text || text.trim() === '') {
        resolve(null);
        return;
    }

    const romanTitle = romanize(text);

    const postData = JSON.stringify({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
      title: romanTitle // Crucial Fix: Use Romanized title
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
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
                const response = JSON.parse(body);
                if (response.embedding && response.embedding.values) {
                    resolve(response.embedding.values);
                } else {
                    console.error(`API Response missing embedding for "${text}":`, body);
                    resolve(null);
                }
            } catch (e) {
                console.error(`Parse Error for "${text}":`, e);
                resolve(null);
            }
        } else {
          console.error(`API Error ${res.statusCode} for "${text}": ${body}`);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
        console.error(`Network Error for "${text}":`, e);
        resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

async function repairEmbeddings() {
  console.log("🚀 Starting Direct Embedding Repair (Native HTTPS + Direct DB)...");
  
  const client = await pool.connect();
  try {
    // 1. Fetch all topics
    const res = await client.query('SELECT id, name_ko FROM t_topics_master ORDER BY id ASC');
    const topics = res.rows;
    console.log(`Found ${topics.length} topics to process.`);

    let updatedCount = 0;
    let failedCount = 0;

    // 2. Process sequentially
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const embedding = await getEmbedding(topic.name_ko);

      if (embedding) {
        const vectorStr = `[${embedding.join(',')}]`;
        await client.query(
          'UPDATE t_topics_master SET embedding = $1 WHERE id = $2',
          [vectorStr, topic.id]
        );
        updatedCount++;
      } else {
        failedCount++;
        console.error(`[${i + 1}/${topics.length}] Failed: "${topic.name_ko}"`);
      }

      // Progress log every 20 items
      if ((i + 1) % 20 === 0) {
        console.log(`   Processed ${i + 1}/${topics.length} (Updated: ${updatedCount}, Failed: ${failedCount})`);
        await new Promise(r => setTimeout(r, 200)); // Rate limit buffer
      }
    }

    console.log(`\n✨ Repair Complete! Total Updated: ${updatedCount}, Failed: ${failedCount}`);

  } catch (err) {
    console.error("Fatal Error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

repairEmbeddings();
