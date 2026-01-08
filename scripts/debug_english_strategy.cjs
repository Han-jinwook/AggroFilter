const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

async function getEmbedding(text, title) {
  return new Promise((resolve) => {
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

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magA * magB);
}

async function compare(labelA, textA, titleA, labelB, textB, titleB) {
    console.log(`\nComparing [${labelA}] vs [${labelB}]...`);
    console.log(`   A: Text="${textA}", Title="${titleA}"`);
    console.log(`   B: Text="${textB}", Title="${titleB}"`);

    const embA = await getEmbedding(textA, titleA);
    const embB = await getEmbedding(textB, titleB);

    if (embA && embB) {
        const sim = cosineSimilarity(embA, embB);
        console.log(`   ✅ Similarity: ${sim.toFixed(4)}`);
    } else {
        console.log("   ❌ Failed to get embeddings");
    }
}

async function main() {
    console.log("🧪 Testing English Translation Strategy for Semantics");

    // Scenario 1: "Study Cafe" vs "Celeb Talk Show"
    // Romanized (Current Failed Strategy)
    await compare(
        "Study Cafe (Romanized)", "스터디카페", "seuteodikape",
        "Celeb Talk Show (Romanized)", "셀럽 토크쇼", "selreob tokeusyo"
    );

    // English Translated
    await compare(
        "Study Cafe (English)", "스터디카페", "Study Cafe",
        "Celeb Talk Show (English)", "셀럽 토크쇼", "Celeb Talk Show"
    );

    // Scenario 2: "Self-employment" vs "Forestry"
    // Romanized (Current Failed Strategy)
    await compare(
        "Self-employment (Romanized)", "자영업", "jangyeongngeob",
        "Forestry (Romanized)", "임업 산업", "imeob saneob"
    );

    // English Translated
    await compare(
        "Self-employment (English)", "자영업", "Self-employment",
        "Forestry (English)", "임업 산업", "Forestry Industry"
    );
}

main();
