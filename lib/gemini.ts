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

// StandardizeTopic 함수 및 관련 헬퍼 함수 제거 (v2.0 Native ID 체제 전환)

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
  thumbnailUrl: string,
  duration?: string
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
    # 어그로필터 분석 AI용 프롬프트 (유튜브 생태계 분석가 모드)
    
    ## 역할
    너는 엄격한 팩트체커가 아니라, **'유튜브 생태계 분석가'**다. 
    유튜브 특유의 표현 방식을 이해하되, 시청자가 실제로 **"속았다"**고 느끼는지 여부를 핵심 기준으로 점수를 매겨라.
    
    ## 분석 및 채점 기준 (Scoring Rubric)
    0점(Clean)에서 100점(Aggro) 사이로 어그로 점수를 매길 때, 아래 기준을 엄격히 따라라.
    
    1. 정확성 점수 (Accuracy Score) - **[선행 평가]**
    - 영상 본문 내용이 팩트에 얼마나 충실한지, 정보로서의 가치가 있는지 0~100점으로 먼저 평가하라.

    2. 어그로 지수 (Clickbait Score) - **[Fact-Based Gap Analysis]** 🎯
    - **핵심 원칙**: 어그로 점수는 단순한 '표현의 자극성'이 아니라, '제목/썸네일이 약속한 내용'과 '실제 영상 내용' 사이의 **불일치(Gap)** 정도를 기준으로 산산정한다.

    - **상세 점수 기준 (The Gap Scale)**:
        - **0~20점 (일치/Marketing)**: [Gap 없음 - 피해 없음] 제목이 자극적이어도 내용이 이를 충분히 뒷받침함. (유튜브 문법상 허용되는 마케팅)
        - **21~40점 (과장/Exaggerated)**: [시간적 피해 (Time Loss)] 작은 사실을 침소봉대하여 시청자의 시간을 낭비하게 함. 핵심 팩트는 있으나 부풀려짐.
        - **41~60점 (왜곡/Distorted)**: [정신적 피해 (Mental Fatigue)] 문맥을 비틀거나 엉뚱한 결론을 내어 시청자에게 혼란과 짜증 유발. 정보 가치 낮음.
        - **61~100점 (허위/Fabricated)**: [실질적 피해 (Loss)] 없는 사실 날조, 사기성 정보. 심각한 오해나 실질적 손실 초래 가능.

    **[논리 일치성 절대 준수]**
    - 자극적인 표현('미쳤다', '방금 터졌다' 등)이 있더라도 내용이 사실이면 어그로 점수를 낮게 책정하라.
    - 텍스트 평가와 수치(점수)의 논리적 일관성을 반드시 유지하라.
    
    2. 신뢰도 및 상대적 평가 (Reliability & Relative Ranking)
    - **신뢰도 계산식**: (정확성 + (100 - 어그로 지수)) / 2
    
    ## 분석 지침 (Critical Instructions)
    1. **수치 데이터 분석 정확도**: 억, 만 등 단위가 포함된 숫자를 철저히 계산하라. 예: 282억 원은 '수백억'대이지 '수십억'대가 아니다. 단위 혼동으로 인한 오판을 절대 하지 마라.
    2. **내부 로직 보안**: 분석 사유 작성 시 "정확도 점수가 70점 이상이므로 어그로 점수를 낮게 책정한다"와 같은 **시스템 내부 채점 규칙이나 로직을 시청자에게 직접 언급하지 마라.** 시청자에게는 오직 영상의 내용과 제목 간의 관계를 바탕으로 한 결과론적 사유만 설명하라.
    
    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 포함하지 말 것.
    - **중요**: subtitleSummary에는 절대 <br /> 등 어떤 HTML 태그도 사용하지 마라. 오직 '0:00 - 내용' 형식의 순수 텍스트만 사용하라. 줄바꿈은 \n 문자만 사용하라.
    - **중요**: evaluationReason 내에서만 문단을 구분할 때 <br /><br /> 태그를 사용하여 강제로 줄바꿈을 표현하라.
    
    {
      "accuracy": 0-100 (정수),
      "clickbait": 0-100 (정수),
      "reliability": 0-100 (정수),
      "subtitleSummary": "반드시 '0:00 - 요약내용' 형식의 타임스탬프를 포함하여 전체 영상의 흐름을 5~10개 내외의 핵심 챕터로 요약하라. 각 챕터는 최소 2~3분 이상의 의미 있는 문맥 단위로 묶어야 하며, 너무 잘게 쪼개지 마라. 특히 영상의 시작부터 마지막 결론(마무리)까지 전체 내용을 빠짐없이 포괄해야 한다. 각 챕터 요약 사이에는 반드시 줄바꿈 문자(\\n)를 넣어라. HTML 태그는 절대 사용 금지.",
      "evaluationReason": "분석 사유를 반드시 다음의 3개 문단으로 엄격히 구분하여 작성하라. 각 문단 사이에는 반드시 <br /><br /> 태그를 넣어라. 각 항목의 제목 줄과 설명 본문 사이에도 반드시 <br /> 태그를 넣어 줄을 분리하라.\n\n1. 내용 정확성 검증 (XX점):<br />영상 본문이 담고 있는 정보의 사실 관계와 객관적 가치를 상세히 분석하라.\n\n2. 어그로성 평가 (XX점):<br />앞서 검증한 실제 내용에 비추어, 제목과 썸네일이 시청자를 얼마나 기만하거나 과장했는지(Gap)를 평가하라.\n\n3. 최종 총평 (🟢Green / 🟡Yellow / 🔴Red):<br />반드시 항목 제목 옆에 해당하는 신호등 이모지(🟢, 🟡, 🔴) 중 하나를 표시하라. 영상의 신뢰도를 종합적으로 판단하여 시청 권장 여부를 서술하라. 시스템 내부 로직은 발설하지 마라.",
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
        responseMimeType: "application/json",
      }
    });
    
    // Construct inputs: text prompt + thumbnail image (if available)
    const finalPrompt = `
      ${systemPrompt}
      
      [분석 대상 데이터]
      채널명: ${channelName}
      제목: ${title}
      자막 내용:
      ${transcript}
    `;

    const inputs: (string | any)[] = [finalPrompt];
    if (thumbnailPart) {
        inputs.push(thumbnailPart);
    }
    
    const result = await generateContentWithRetry(model, inputs);
    
    // Validate response immediately to trigger fallback if blocked/empty
    const response = await result.response;
    const text = response.text();
    console.log("Raw AI Response:", text);
    if (!text) throw new Error("Empty response from AI (Likely Safety Block)");
    
    return result;
  };

  try {
    let result;
    // Strategy: Fix to Gemini 2.5 Flash for consistent testing and production
    const modelsToTry = ["gemini-2.5-flash"];
    
    let lastError;
    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting analysis with model: ${modelName}`);
        result = await tryModel(modelName);
        if (result) break; // Success
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ Model ${modelName} failed: ${error.message}`);
        
        // If it's a quota error (429), we might want to wait a bit before trying the next model
        if (error.message?.includes('429') || error.message?.includes('quota')) {
          console.log('Quota exceeded, trying next model or retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!result && lastError) {
      throw lastError;
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

    // [Final Safety Check] 삭제
    // standardizeTopic 호출 및 관련 로직 제거
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
