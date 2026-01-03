import { GoogleGenerativeAI } from "@google/generative-ai";
import { pool } from '@/lib/db';
import https from 'https';
import { romanize } from '@/lib/hangul';

// Helper: Translate text to English (for embedding semantic consistency)
export async function translateText(text: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  try {
    const result = await model.generateContent(`Translate "${text}" to English. Output ONLY the English text, nothing else.`);
    return result.response.text().trim();
  } catch (e) {
    console.error(`Translation failed for "${text}":`, e);
    return romanize(text); // Fallback to Romanization if translation fails
  }
}

// Helper: Generate embedding for a text using native https + English Title strategy
export async function getEmbedding(text: string, apiKey: string, titleOverride?: string): Promise<number[] | null> {
  return new Promise(async (resolve) => {
    // Ensure text is clean
    if (!text || text.trim() === '') {
        resolve(null);
        return;
    }

    // Critical: Use English title for embedding generation if provided, otherwise Romanize
    let title = titleOverride;
    if (!title) {
       // If no title provided, strictly we should translate, but to keep this function pure-ish, 
       // we might rely on the caller. However, for safety in this specific architecture:
       // We will assume the caller MUST provide it for best results. 
       // If missing, we fallback to Romanization (which might mismatch the new English DB, but prevents crash).
       title = romanize(text); 
    }

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

// Helper: Find closest topic in DB
export async function findClosestTopic(embedding: number[]): Promise<{ name: string, score: number } | null> {
  try {
    // Cosine similarity search using pgvector (<=> is distance, so 1 - distance is similarity)
    
    const client = await pool.connect();
    try {
        const vectorStr = `[${embedding.join(',')}]`;
        
        const res = await client.query(`
            SELECT name_ko, (embedding <=> $1) as distance
            FROM t_topics_master
            ORDER BY embedding <=> $1
            LIMIT 1
        `, [vectorStr]);

        if (res.rows.length > 0) {
            const bestMatch = res.rows[0];
            const similarity = 1 - bestMatch.distance; // Convert distance to similarity
            console.log(`Topic Match: "${bestMatch.name_ko}" (Similarity: ${(similarity * 100).toFixed(1)}%)`);
            
            if (similarity >= 0.65) {
                return { name: bestMatch.name_ko, score: similarity };
            }
        }
        return null; // No match found
    } finally {
        client.release();
    }
  } catch (error) {
    console.error("Vector Search Error:", error);
    return null;
  }
}

export async function standardizeTopic(topic: string, apiKey: string, topicEn?: string): Promise<{ finalTopic: string, isNew: boolean, log: string }> {
    let finalTopic = topic;
    let log = "";
    let isNew = false;

    // [Safety Guard] 강제 2단어 트리밍
    const words = finalTopic.trim().split(/\s+/);
    if (words.length > 2) {
        const original = finalTopic;
        finalTopic = words.slice(0, 2).join(' '); // 앞 2단어만 사용
        log += `[Truncated] "${original}" -> "${finalTopic}". `;
        console.warn(`⚠️ Topic Violation Fix: "${original}" -> "${finalTopic}"`);
    }

    console.log(`Processing Topic: "${finalTopic}"`);
    
    // Ensure we have an English title for embedding
    let englishTitle = topicEn;
    if (!englishTitle) {
        console.log(`Translating topic "${finalTopic}" for embedding...`);
        englishTitle = await translateText(finalTopic, apiKey);
    }

    const aiTopicEmbedding = await getEmbedding(finalTopic, apiKey, englishTitle);
    
    if (aiTopicEmbedding) {
        const existingTopicMatch = await findClosestTopic(aiTopicEmbedding);
        if (existingTopicMatch) {
            log += `[Standardized] "${finalTopic}" -> "${existingTopicMatch.name}" (Score: ${(existingTopicMatch.score * 100).toFixed(1)}%).`;
            console.log(`Topic Standardized: "${finalTopic}" -> "${existingTopicMatch.name}"`);
            finalTopic = existingTopicMatch.name; 
        } else {
            log += `[New Topic] "${finalTopic}" registered (No match >= 65%).`;
            console.log(`New Topic Detected: "${finalTopic}" (No match >= 65%)`);
            isNew = true;
            
            // Auto-register new topic as Master Topic
            try {
                const client = await pool.connect();
                try {
                    const vectorStr = `[${aiTopicEmbedding.join(',')}]`;
                    await client.query(`
                        INSERT INTO t_topics_master (name_ko, embedding)
                        VALUES ($1, $2)
                        ON CONFLICT (name_ko) DO NOTHING
                    `, [finalTopic, vectorStr]);
                    
                    console.log(`✅ New Master Topic Registered: "${finalTopic}"`);
                } finally {
                    client.release();
                }
            } catch (dbError) {
                console.error("Failed to auto-register new master topic:", dbError);
                log += " (DB Error during registration).";
            }
        }
    } else {
        log += " (Embedding generation failed).";
    }

    return { finalTopic, isNew, log };
}

export async function analyzeContent(
  channelName: string,
  title: string,
  transcript: string,
  thumbnailUrl: string
) {
  // .env 파일의 GOOGLE_API_KEY를 우선적으로 사용
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  // Debug log (masked)
  console.log("Gemini API Key Loaded:", apiKey ? "Yes (Starts with " + apiKey.substring(0, 4) + ")" : "No");

  if (!apiKey) {
    console.error("API Key is not set");
    throw new Error("GOOGLE_API_KEY is not set in environment variables");
  }

  // Gemini API 클라이언트 초기화
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    console.log("Initializing Gemini model: gemini-2.5-flash");
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2, // 점수 산출의 정확성을 위해 낮게 설정 (프롬프트 가이드 준수)
        topP: 0.85,
      }
    });

    const systemPrompt = `
    # 어그로필터 분석 AI용 프롬프트 (유튜브 영상 전용)
    
    ## 역할
    너는 유튜브 영상의 제목, 썸네일, 본문 내용을 분석하여, 정확성, 어그로성, 신뢰도 점수를 산출하고, 평가 근거와 필요 시 착한 제목을 제안하는 분석 시스템이다. 분석 결과는 항상 콘텐츠의 원래 언어로 작성하며, 같은 콘텐츠는 언제나 일관된 결과가 나와야 한다.
    
    ## 분석 기준
    1. 주제 선정 기준 (매우 중요 - 구체적 소재가 아닌 '분야'를 선택할 것)
    - 콘텐츠의 핵심 내용을 포괄하는 **가장 거시적이고 일반적인 카테고리(분야)**를 선정하시오.
    - **반드시 한글 2단어 (명사 + 명사, 혹은 형용사 + 명사)** 형태로 작성할 것.
    - **절대 금지**: 구체적인 고유명사(국가명, 브랜드명, 인물명 등)나 미시적인 소재를 주제로 삼지 말 것.
      - (X) "베네수엘라 사태", "아이폰 리뷰", "이재명 발언", "스터디카페"
      - (O) "국제 정세", "IT 기기", "국내 정치", "자영업 창업"
    - **참고 표준 주제어 목록** (가능하면 아래 목록이나 이와 유사한 수준의 단어를 선택하시오):
      - [정치/사회]: 국제 정세, 국내 정치, 시사 이슈, 사회 문제, 외교 안보, 법률 상식
      - [경제/금융]: 세계 경제, 경제 분석, 주식 투자, 부동산, 생활 경제, 재테크
      - [비즈니스]: 자영업, 창업 정보, 기업 경영, 마케팅, 성공 마인드
      - [기술/과학]: IT 기술, 과학 기술, 미래 산업, AI 트렌드
      - [라이프]: 건강 정보, 자기 개발, 인간 관계, 심리 분석
    - **[중요] 선정된 한글 주제의 영문 번역(topic_en)도 반드시 함께 반환할 것.** (예: "국제 정세" -> "International Politics")
    
    2. 정확성 평가 기준
    - 제목과 본문 내용 일치도
    - 광고성 여부 판단 및 진실성
    - 감정적 프레임, 편향적 해석, 왜곡 여부
    - 출처 및 인용 데이터의 공신력
    - 정확성: 1~100점 (근거 필수 기재)
    
    3. 어그로성 평가 기준 (매우 중요: 상대적 평가 도입)
    - **핵심 원칙**: '흥미 유발(Hook)'과 '기만(Deception)'을 철저히 구분할 것.
    - **착한 어그로(Good Hook)**: 제목이 호기심을 자극하거나 강한 표현을 썼더라도, 본문 내용이 그 의문을 **충실하고 정확하게 해소**한다면 이는 '마케팅적 요소'로 보아 점수를 낮게 책정해야 한다 (권장: 0~25%).
    - **나쁜 어그로(Bad Clickbait)**: 제목이 약속한 내용을 본문에서 다루지 않거나, 결론을 질질 끌거나, 전혀 다른 내용을 다룰 때 높은 점수를 부여한다.
    - **점수 보정 로직**: 만약 **정확성 점수가 80점 이상**이라면, 단순한 '궁금증 유발형 제목'이나 '강조된 썸네일'에 대한 어그로성 점수는 **절반 이하로 대폭 감경**하라.
    - 예시: "충격적인 진실 공개"라는 제목이지만 내용이 그 진실을 명확하고 논리적으로 설명함 -> 어그로성 10~20%.
    - 어그로성: 1~100% (근거 필수 기재)
    
    4. 신뢰도 점수 환산
    - 계산식: 신뢰도 = (정확성 + (100 - 어그로성)) ÷ 2
    - 신뢰도: 0~100점
    
    5. 평가이유 작성 기준
    - 정확성, 어그로성, 신뢰도 점수를 부여한 근거를 구체적으로 작성
    - 숨은 의도(상업적, 정치적, 여론조작 등)가 있다면 자연스럽게 포함해 설명
    - 친근하고 자연스러운 어투로 작성
    - **평가이유 총평에 신뢰도 점수에 따른 신호등 색상과 의미(안심, 주의, 경고)를 반드시 포함**
    - 신뢰도 70점 이상: 녹색불 (안심)
    - 신뢰도 50~69점: 노란불 (주의)
    - 신뢰도 50점 미만: 빨간불 (경고)
    
    6. 추천 제목 생성 기준
    - 어그로성이 30% 이상일 경우, 감정적/과장적 요소 제거 후 내용을 정확히 반영한 재미도 가미된 착하고 합리적인 제목 추천
    
    ## 입력 데이터
    - 채널명: ${channelName}
    - 제목: ${title}
    - 내용(자막): ${transcript.substring(0, 50000)} (길 경우 앞부분 사용)
    
    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 마크다운 포맷팅(\`\`\`json)을 포함하지 말 것.
    
    {
      "topic": "한글 주제 (2단어 이내)",
      "topic_en": "English Translation of topic (Essential for vector search)",
      "accuracy": 0-100 (정수),
      "clickbait": 0-100 (정수),
      "reliability": 0-100 (정수),
      "subtitleSummary": "시간순 챕터별 주요 내용 요약 (상세하게)",
      "evaluationReason": "점수 부여 근거 및 숨은 의도 상세 서술. 총평(신호등 등급 포함) 필수.",
      "overallAssessment": "전반적인 평가 및 시청자 유의사항",
      "recommendedTitle": "어그로성 30% 이상일 때만 추천 제목 (아니면 빈 문자열)"
    }
    `;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON 파싱 (혹시 모를 마크다운 제거)
    const jsonString = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim();
    
    let analysisData;
    try {
      analysisData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw Text:", text);
      throw new Error("Failed to parse AI response");
    }

    // --- Topic Standardization Logic ---
    if (analysisData.topic) {
        // Pass the topic_en provided by AI to avoid extra translation step
        const { finalTopic } = await standardizeTopic(analysisData.topic, apiKey, analysisData.topic_en);
        analysisData.topic = finalTopic;
    }
    // -----------------------------------

    return analysisData;

  } catch (error) {
    console.error("Gemini Analysis Error Full Details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    // 에러 시 기본값 반환으로 서비스 중단 방지
    return {
      topic: "분석 실패",
      topic_en: "Analysis Failed",
      accuracy: 0,
      clickbait: 0,
      reliability: 0,
      subtitleSummary: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      evaluationReason: "일시적인 오류로 분석을 완료할 수 없습니다.",
      overallAssessment: "잠시 후 다시 시도해주세요.",
      recommendedTitle: title
    };
  }
}
