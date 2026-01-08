const { Pool } = require('pg');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

// Romanization Logic (Inlined)
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

async function getEmbedding(text) {
  return new Promise((resolve) => {
    if (!text || text.trim() === '') {
        resolve(null);
        return;
    }

    const romanTitle = romanize(text);
    console.log(`   (Romanized: "${romanTitle}")`);

    const postData = JSON.stringify({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
      title: romanTitle
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
    
    // 1. Generate Embedding
    const embedding = await getEmbedding(inputTopic);
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

        // 3. Check specific distance to "셀럽 토크쇼"
        const specificRes = await client.query(`
            SELECT name_ko, (embedding <=> $1) as distance
            FROM t_topics_master
            WHERE name_ko = '셀럽 토크쇼'
        `, [vectorStr]);
        
        if (specificRes.rows.length > 0) {
            const sim = (1 - specificRes.rows[0].distance).toFixed(4);
            console.log(`\n⚠️ Distance to "셀럽 토크쇼": ${sim}`);
        }

    } finally {
        client.release();
    }
}

async function main() {
    // Potential topics from the video
    await checkTopicMatch("스터디카페");
    await checkTopicMatch("창업");
    await checkTopicMatch("폐업");
    await checkTopicMatch("자영업");
    await checkTopicMatch("셀럽 토크쇼"); // Check self-match
}

main().catch(console.error);
