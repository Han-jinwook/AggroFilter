import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { pool } from '@/lib/db';
import https from 'https';
import { romanize } from '@/lib/hangul';

// Helper: Translate text to English (for embedding semantic consistency)
export async function translateText(text: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Using the fastest valid model for simple translation tasks
  // Updated to gemini-2.5-flash-lite for speed and availability
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  
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

// Helper: Retry logic wrapper with exponential backoff
async function generateContentWithRetry(model: any, prompt: string | Array<string | any>, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (error: any) {
      lastError = error;
      const isOverloaded = error.message?.includes('503') || error.message?.includes('overloaded');
      
      if (isOverloaded && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`⚠️ Model overloaded (503). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error; // Throw non-retriable errors or if max retries reached
    }
  }
  throw lastError;
}

// Helper: Fetch image from URL and convert to Generative Part
async function urlToGenerativePart(url: string) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to fetch thumbnail: ${response.statusText}`);
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: response.headers.get("content-type") || "image/jpeg",
            },
        };
    } catch (error) {
        console.error("Error processing thumbnail for AI:", error);
        return null;
    }
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

  // 썸네일 이미지 준비 (멀티모달 분석용)
  let thumbnailPart = null;
  if (thumbnailUrl) {
      console.log("Fetching thumbnail for analysis:", thumbnailUrl);
      thumbnailPart = await urlToGenerativePart(thumbnailUrl);
  }

  const systemPrompt = `
    # 어그로필터 분석 AI용 프롬프트 (영상 및 썸네일 멀티모달 분석)
    
    ## 역할
    너는 유튜브 영상의 **제목, 썸네일(이미지), 본문 내용**을 종합적으로 분석하여, 정확성, 어그로성, 신뢰도 점수를 산출하고 평가하는 시스템이다. 
    특히 **썸네일의 시각적 과장**과 **제목의 워딩**이 **본문의 실제 팩트**와 얼마나 괴리감이 있는지를 냉정하게 판단해야 한다.
    
    ## 분석 기준
    1. 주제 선정 기준 (매우 중요 - 소재가 아닌 '관점'으로 분류할 것)
    - 콘텐츠가 다루는 핵심 소재(Keyword)가 아니라, 그 소재를 **다루는 방식과 목적(Perspective)**을 보고 분야를 결정하시오.
    - **[핵심 구분 가이드 (오분류 주의)]**:
      - **소재: 지진/쓰나미/화산/태풍**
        - (Prioritize) **"재난 이슈"**: 지질학적 분석이 포함되어 있더라도, 결론이 **"위험성 경고", "피해 예측", "대피 필요성", "사회적 파장"**으로 귀결된다면 반드시 이쪽으로 분류.
        - (Limit) **"지구 과학"**: 순수하게 판 구조론, 단층의 원리 등 **교과서적인 이론 설명**에만 집중하고, 현실적인 공포나 위험을 강조하지 않는 교육용 콘텐츠일 때만 선택.
        - (Forbidden) **"환경 문제"**: 지진은 지각 변동(Tectonics)이지, 환경 오염이나 기후 변화(Climate Change)가 아님. **절대 혼동 금지.**
      - **소재: 환경/기후**
        - (O) **"환경 문제"**: 쓰레기, 수질 오염, 미세먼지, 지구 온난화, 이상 기후 등 **인위적이거나 장기적인 환경 변화**를 다룰 때만 사용.
        - (X) 급작스러운 자연 재해(지진/화산) -> "재난 이슈"
      - **소재: 질병/건강**
        - (X) "이것 먹으면 암 걸린다", 공포 마케팅 -> **"건강 정보"**
        - (O) 의학적 기전, 임상 실험 결과 분석 -> **"의학"**
    - **반드시 한글 2단어 (명사 + 명사, 혹은 형용사 + 명사)** 형태로 작성할 것.
    - **절대 금지**: 구체적인 고유명사(국가명, 브랜드명, 인물명 등)나 미시적인 소재를 주제로 삼지 말 것.
      - (X) "베네수엘라 사태", "아이폰 리뷰", "이재명 발언", "일본 지진"
      - (O) "국제 정세", "IT 기기", "국내 정치", "재난 이슈"
    - **참고 표준 주제어 목록** (가능하면 아래 목록이나 이와 유사한 수준의 단어를 선택하시오):
      - [정치/사회]: 국제 정세, 국내 정치, 시사 이슈, 사회 문제, 재난 이슈, 법률 상식
      - [경제/금융]: 세계 경제, 경제 분석, 주식 투자, 부동산, 생활 경제, 재테크
      - [비즈니스]: 자영업, 창업 정보, 기업 경영, 마케팅, 성공 마인드
      - [기술/과학]: IT 기술, 과학 기술, 미래 산업, AI 트렌드, 토목 공학, 지구 과학
      - [라이프]: 건강 정보, 자기 개발, 인간 관계, 심리 분석
    - **[중요] 선정된 한글 주제의 영문 번역(topic_en)도 반드시 함께 반환할 것.** (예: "국제 정세" -> "International Politics")
    
    2. 정확성 평가 기준
    - 제목과 본문 내용 일치도
    - 광고성 여부 판단 및 진실성
    - 감정적 프레임, 편향적 해석, 왜곡 여부
    - 출처 및 인용 데이터의 공신력
    - 정확성: 1~100점 (근거 필수 기재)
    
    3. 어그로성 평가 기준 (썸네일 포함 Gap 분석 - 신중한 채점)
    - **핵심 원칙**: "실제 팩트의 무게"와 "표현(제목+썸네일)의 무게" 사이의 **괴리감(Gap)**을 측정하라.
    - **점수 인플레이션 주의**: 단순히 제목이 자극적이라고 해서 무조건 90점을 주지 말 것. 내용이 그 자극적인 제목을 어느 정도 뒷받침한다면 점수를 낮춰야 한다.
    - **평가 가이드**:
      - **0~20점 (정상)**: 제목이 내용을 정직하게 요약함.
      - **21~40점 (약간의 MSG)**: 흥미 유발을 위한 가벼운 과장이나 호기심 자극. (용인 가능한 수준)
      - **41~70점 (심한 과장)**: "충격", "긴급", "경악" 등의 단어를 썼으나, 내용은 그 정도까지는 아님. (비판적 시청 필요)
      - **71~100점 (허위/낚시/혐오)**: 
        - 썸네일/제목 내용이 본문에 아예 없거나 거짓임.
        - 재난/사망 등 심각한 소재로 거짓 공포를 조장함 ("일본 침몰 시작", "한국 곧 멸망").
        - 합성된 가짜 이미지를 사용하여 시청자를 기만함.
    
    4. 신뢰도 점수 환산
    - 계산식: 신뢰도 = (정확성 + (100 - 어그로성)) ÷ 2
    - 해석: 팩트가 정확해도(100점), 사소한 걸로 호들갑을 떨면(어그로 60점) 신뢰도는 70점으로 떨어진다.
    
    5. 평가이유 작성 기준
    - 정확성, 어그로성(썸네일/제목 분석 포함), 신뢰도 점수를 부여한 근거를 구체적으로 작성
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
    - [이미지 첨부됨]: 썸네일 이미지
    
    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 마크다운 포맷팅(\`\`\`json)을 포함하지 말 것.
    
    {
      "topic": "한글 주제 (2단어 이내)",
      "topic_en": "English Translation of topic (Essential for vector search)",
      "accuracy": 0-100 (정수),
      "clickbait": 0-100 (정수),
      "reliability": 0-100 (정수),
      "subtitleSummary": "시간순 챕터별 주요 내용 요약 (상세하게)",
      "evaluationReason": "점수 부여 근거(썸네일/제목 분석 포함) 및 숨은 의도 상세 서술. 총평(신호등 등급 포함) 필수.",
      "overallAssessment": "전반적인 평가 및 시청자 유의사항",
      "recommendedTitle": "어그로성 30% 이상일 때만 추천 제목 (아니면 빈 문자열)"
    }
    `;

  // Strategy: Try Primary Model (2.5) -> Retry -> Fallback Model (1.5) -> Retry
  const tryModel = async (modelName: string) => {
    console.log(`Initializing Gemini model: ${modelName}`);
    
    // Allow controversial content for analysis purposes (Analysis tool need to see the bad stuff to rate it)
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const model = genAI.getGenerativeModel({ 
      model: modelName,
      safetySettings,
      generationConfig: {
        temperature: 0.2,
        topP: 0.85,
      }
    });
    
    // Construct inputs: text prompt + thumbnail image (if available)
    const inputs: (string | any)[] = [systemPrompt];
    if (thumbnailPart) {
        inputs.push(thumbnailPart);
    }
    
    const result = await generateContentWithRetry(model, inputs);
    
    // Validate response immediately to trigger fallback if blocked/empty
    const text = result.response.text();
    if (!text) throw new Error("Empty response from AI (Likely Safety Block)");
    
    return result;
  };

  try {
    let result;
    try {
        // 1. Primary Model Attempt (High Quality Logic)
        // User requested higher quality for better nuance in clickbait/topic classification.
        // Updated to gemini-2.5-flash (Latest stable)
        result = await tryModel("gemini-2.5-flash"); 
    } catch (primaryError: any) {
        console.warn(`⚠️ Primary model (gemini-2.5-flash) failed: ${primaryError.message}. Switching to fallback...`);
        // 2. Fallback Model Attempt (Speed/Stability)
        // Fallback to gemini-2.0-flash-lite which is verified available
        result = await tryModel("gemini-2.0-flash-lite");
    }

    const response = await result.response;
    const text = response.text();
    
    // JSON 파싱 (혹시 모를 마크다운 제거)
    let jsonString = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim();

    // [Robust Parsing] JSON 객체 부분만 정교하게 추출 (앞뒤 사족 제거)
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }
    
    let analysisData;
    try {
      analysisData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw Text:", text);
      throw new Error("Failed to parse AI response");
    }

    // --- Topic Standardization Logic (Fail-safe) ---
    // [Post-Processing] 강제 보정 로직: 지진/재난 키워드가 있는데 '환경 문제'나 '지구 과학'으로 오분류된 경우 수정
    // 사용자의 강력한 피드백 반영: "학문 탐구가 아니라 재난 고발이다"
    if (analysisData.topic === '환경 문제' || analysisData.topic === '지구 과학') {
        const disasterKeywords = ['지진', '쓰나미', '해일', '화산', '대피', '경보', '규모', '여진', '전진', '단층', '판 구조'];
        const contentToCheck = (title + ' ' + (analysisData.summarySubtitle || '')).toLowerCase();
        
        const isDisaster = disasterKeywords.some(keyword => contentToCheck.includes(keyword));
        
        if (isDisaster) {
            console.warn(`⚠️ Topic Correction: "${analysisData.topic}" -> "재난 이슈" (Disaster keywords detected)`);
            analysisData.topic = '재난 이슈';
            analysisData.topic_en = 'Disaster Issue'; // 영문 토픽도 함께 수정
        }
    }

    // 주제 표준화가 실패하더라도 분석 결과 자체는 반환되어야 함.
    if (analysisData.topic) {
        try {
            // Pass the topic_en provided by AI to avoid extra translation step
            // Add timeout race to prevent hanging
            const standardizePromise = standardizeTopic(analysisData.topic, apiKey, analysisData.topic_en);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Standardization Timeout")), 5000));
            
            const { finalTopic } = await Promise.race([standardizePromise, timeoutPromise]) as any;
            analysisData.topic = finalTopic;
        } catch (topicError) {
            console.warn(`⚠️ Topic standardization failed (using original topic):`, topicError);
            // 에러 발생 시 원래 토픽 유지 (무시)
        }
    }

    // [Final Safety Check] 표준화 후에도 '환경 문제' 등으로 잘못 분류되었다면 다시 한번 강제 보정
    // standardizeTopic이 유사도 기반으로 엉뚱한 기존 토픽('환경 문제')을 가져왔을 경우를 대비
    if (analysisData.topic === '환경 문제' || analysisData.topic === '지구 과학') {
        const disasterKeywords = ['지진', '쓰나미', '해일', '화산', '대피', '경보', '규모', '여진', '전진', '단층', '판 구조'];
        
        // [Fix] Check both possible keys for summary content (AI sometimes hallucinates key names)
        const summaryText = analysisData.subtitleSummary || analysisData.summarySubtitle || '';
        const contentToCheck = (title + ' ' + summaryText).toLowerCase();
        
        const isDisaster = disasterKeywords.some(keyword => contentToCheck.includes(keyword));
        
        if (isDisaster) {
            console.warn(`⚠️ Final Topic Correction: "${analysisData.topic}" -> "재난 이슈" (After standardization)`);
            analysisData.topic = '재난 이슈';
            analysisData.topic_en = 'Disaster Issue';
        }
    }
    // -----------------------------------

    return analysisData;

  } catch (error: any) {
    console.error("Gemini Analysis Error Full Details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    // 에러 시 기본값 반환으로 서비스 중단 방지
    return {
      topic: "분석 실패",
      topic_en: "Analysis Failed",
      accuracy: 0,
      clickbait: 0,
      reliability: 0,
      subtitleSummary: `AI 분석 중 오류가 발생했습니다. (Error: ${error.message})`,
      evaluationReason: "일시적인 오류로 분석을 완료할 수 없습니다.",
      overallAssessment: "잠시 후 다시 시도해주세요.",
      recommendedTitle: title
    };
  }
}
