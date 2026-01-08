// import fetch from 'node-fetch'; // Should use native fetch in Node 18+, but keeping import if env is older, actually native fetch is fine.
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import pg from 'pg';

// Load env
dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function getEmbedding(text) {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error(`Error generating embedding for "${text}":`, error);
    return null;
  }
}

async function fixTopics() {
  try {
    const client = await pool.connect();
    
    // 1. Get violations directly from DB
    const res = await client.query(`
        SELECT id, name_ko 
        FROM t_topics_master 
        WHERE array_length(string_to_array(trim(name_ko), ' '), 1) > 2
    `);
    
    const violations = res.rows;
    console.log(`Found ${violations.length} violations (3+ words).`);
    
    if (violations.length === 0) return;

    // 2. Ask AI to fix them
    const violationNames = violations.map(v => v.name_ko);
    
    const prompt = `
    다음은 "2단어 규칙"을 위반한 3단어 이상의 주제어 리스트야.
    이것들을 **반드시 2단어 (띄어쓰기 1회 포함)**로 압축하거나 수정해줘.
    
    [규칙]
    1. 핵심 의미를 유지하면서 가장 짧고 명확한 2단어로 줄일 것.
    2. 예시: "AI 교육 자료" -> "AI 교육" 또는 "교육 자료" (더 중요한 쪽으로)
    3. 예시: "AI 개발 도구" -> "AI 개발"
    4. 예시: "부동산 투자 전략" -> "부동산 투자"
    5. JSON 형식으로 { "원래주제": "수정주제", ... } 형태로 반환.

    [대상 리스트]
    ${JSON.stringify(violationNames)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonString = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim();
    const mapping = JSON.parse(jsonString);

    console.log("AI suggested fixes:", mapping);

    // 3. Update DB
    for (const violation of violations) {
        const originalName = violation.name_ko;
        const newName = mapping[originalName];

        if (newName && newName !== originalName) {
             // Generate new embedding
             const newEmbedding = await getEmbedding(newName);
             if (newEmbedding) {
                 const vectorStr = `[${newEmbedding.join(',')}]`;
                 
                 // Check if new name already exists (collision)
                 const existing = await client.query('SELECT id FROM t_topics_master WHERE name_ko = $1', [newName]);
                 
                 if (existing.rows.length > 0) {
                     // If exists, just delete the violation (merge effect)
                     await client.query('DELETE FROM t_topics_master WHERE id = $1', [violation.id]);
                     console.log(`Merged: "${originalName}" -> "${newName}" (Deleted old record)`);
                 } else {
                     // Update name and embedding
                     await client.query(`
                        UPDATE t_topics_master 
                        SET name_ko = $1, embedding = $2 
                        WHERE id = $3
                     `, [newName, vectorStr, violation.id]);
                     console.log(`Updated: "${originalName}" -> "${newName}"`);
                 }
             }
        }
    }

    client.release();
    console.log("✅ Fix complete.");

  } catch (e) {
    console.error("Error fixing topics:", e);
  } finally {
    await pool.end();
  }
}

fixTopics();
