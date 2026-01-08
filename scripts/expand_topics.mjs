import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

// Load env
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("No API Key found");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function expandTopics() {
    const topicsPath = path.join(process.cwd(), 'data/topics.json');
    const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf-8'));
    
    // 1. Identify 1-word topics
    const oneWordTopics = topics.filter(t => !t.trim().includes(' '));
    console.log(`Found ${oneWordTopics.length} single-word topics to expand.`);

    if (oneWordTopics.length === 0) {
        console.log("No single-word topics found.");
        return;
    }

    // 2. Ask Gemini to expand them
    const prompt = `
    다음은 유튜브 영상 분석 서비스의 '주제어' 리스트야.
    현재 1단어로 된 주제어들을 "2단어 합성어"로 명확하게 확장해줘.
    
    [규칙]
    1. 반드시 한글 2단어 (또는 영문+한글, 영문+영문 등 띄어쓰기 1회 포함)로 만들 것.
    2. 원래 의미를 가장 잘 대표하는 일반적인 단어를 붙일 것.
       예) "주식" -> "주식 투자", "부동산" -> "부동산 시장", "가격" -> "가격 동향", "CNN" -> "CNN 알고리즘"
    3. JSON 형식으로 { "원래단어": "새단어", ... } 형태로 반환해줘.

    [대상 리스트]
    ${JSON.stringify(oneWordTopics)}
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonString = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim();
        const mapping = JSON.parse(jsonString);

        // 3. Update the list
        const newTopics = topics.map(t => {
            if (mapping[t]) {
                return mapping[t];
            }
            return t;
        });

        // Deduplicate
        const uniqueTopics = Array.from(new Set(newTopics)).sort();

        fs.writeFileSync(topicsPath, JSON.stringify(uniqueTopics, null, 2));
        console.log(`✅ Updated topics list! Total: ${uniqueTopics.length}`);
        
        // Show some examples
        console.log("Examples of changes:");
        Object.entries(mapping).slice(0, 10).forEach(([k, v]) => console.log(`- ${k} -> ${v}`));

    } catch (e) {
        console.error("Error expanding topics:", e);
    }
}

expandTopics();
