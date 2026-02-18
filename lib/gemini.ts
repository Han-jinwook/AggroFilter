import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { pool } from '@/lib/db';
import https from 'https';
import { romanize } from '@/lib/hangul';

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseIso8601DurationToSeconds(iso?: string): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  const seconds = match[3] ? Number(match[3]) : 0;
  if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function getThumbnailFallbackUrls(url: string): string[] {
  const urls: string[] = [];
  if (url) urls.push(url);

  const candidates = [
    { from: '/maxresdefault.jpg', to: '/hqdefault.jpg' },
    { from: '/maxresdefault.jpg', to: '/mqdefault.jpg' },
    { from: '/sddefault.jpg', to: '/hqdefault.jpg' },
  ];

  for (const c of candidates) {
    if (url.includes(c.from)) {
      urls.push(url.replace(c.from, c.to));
    }
  }

  return Array.from(new Set(urls));
}

function shouldSkipSmartSummary(params: {
  durationIso?: string;
  transcript?: string;
  transcriptItems?: { text: string; start: number; duration: number }[];
}) {
  const durationSec = parseIso8601DurationToSeconds(params.durationIso);
  if (typeof durationSec === 'number' && durationSec > 0 && durationSec <= 90) return true;

  const itemsCount = Array.isArray(params.transcriptItems) ? params.transcriptItems.length : 0;
  if (itemsCount > 0 && itemsCount <= 30) return true;

  const transcriptLen = typeof params.transcript === 'string' ? params.transcript.length : 0;
  if (transcriptLen > 0 && transcriptLen <= 1500) return true;

  return false;
}

function getGeminiAnalysisProfile(params: {
  durationIso?: string;
  transcript?: string;
  transcriptItems?: { text: string; start: number; duration: number }[];
}) {
  const durationSec = parseIso8601DurationToSeconds(params.durationIso);
  const itemsCount = Array.isArray(params.transcriptItems) ? params.transcriptItems.length : 0;
  const transcriptLen = typeof params.transcript === 'string' ? params.transcript.length : 0;

  const isShortForm =
    (typeof durationSec === 'number' && durationSec > 0 && durationSec <= 90) ||
    (itemsCount > 0 && itemsCount <= 30) ||
    (transcriptLen > 0 && transcriptLen <= 1500);

  return {
    isShortForm,
    timeoutMs: isShortForm ? 18000 : 23000,
    retries: isShortForm ? 2 : 1,
    baseDelayMs: 800,
  };
}

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

// Helper: Retry logic wrapper with exponential backoff + per-attempt timeout
async function generateContentWithRetry(
  model: any,
  prompt: string | Array<string | any>,
  options?: { timeoutMs?: number; maxRetries?: number; baseDelayMs?: number }
) {
  let lastError;

  const timeoutMs = options?.timeoutMs ?? 18000;
  const maxRetries = options?.maxRetries ?? 1;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  const isTransientError = (err: any) => {
    const msg = String(err?.message || '');
    const name = String(err?.name || '');
    const code = String(err?.code || '');
    return (
      msg.includes('timeout') ||
      msg.includes('429') ||
      msg.toLowerCase().includes('quota') ||
      msg.includes('503') ||
      msg.toLowerCase().includes('overloaded') ||
      name.includes('AbortError') ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET'
    );
  };

  for (let i = 0; i < maxRetries; i++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini API timeout (${Math.round(timeoutMs / 1000)}s)`)), timeoutMs)
      );
      return await Promise.race([model.generateContent(prompt), timeoutPromise]);
    } catch (error: any) {
      lastError = error;

      if (isTransientError(error) && i < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        console.warn(
          `⚠️ Gemini transient error. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`,
          { message: error?.message }
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
  throw lastError;
}

// Helper: Fetch image from URL and convert to Generative Part
async function urlToGenerativePart(url: string) {
    try {
        const urlsToTry = getThumbnailFallbackUrls(url);
        for (const candidateUrl of urlsToTry) {
          try {
            const response = await fetchWithTimeout(candidateUrl, 1500);
            if (!response.ok) {
              console.warn(`Failed to fetch thumbnail: ${response.statusText}`);
              continue;
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            return {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType: response.headers.get("content-type") || "image/jpeg",
              },
            };
          } catch (e) {
            console.warn(`Thumbnail fetch failed for ${candidateUrl}:`, e);
            continue;
          }
        }
        return null;
    } catch (error) {
        console.error("Error processing thumbnail for AI:", error);
        return null;
    }
}

function chunkTranscript(transcript: string, maxChunkLength = 5000): { startTime: string, text: string }[] {
  const lines = transcript.split('\n');
  const chunks: { startTime: string, text: string }[] = [];
  let currentChunkText = '';
  let currentChunkStartTime = '0:00';

  for (const line of lines) {
    const timestampMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)/);
    const timestamp = timestampMatch ? timestampMatch[1] : null;

    if (timestamp && currentChunkText.length >= maxChunkLength) {
      chunks.push({ startTime: currentChunkStartTime, text: currentChunkText.trim() });
      currentChunkStartTime = timestamp;
      currentChunkText = '';
    }
    currentChunkText += line + '\n';
  }

  if (currentChunkText.trim()) {
    chunks.push({ startTime: currentChunkStartTime, text: currentChunkText.trim() });
  }

  return chunks;
}

function coalesceChunks(
  chunks: { startTime: string; text: string }[],
  maxChunks: number
): { startTime: string; text: string }[] {
  if (chunks.length <= maxChunks) return chunks;
  if (maxChunks <= 0) return [];

  const groupSize = Math.ceil(chunks.length / maxChunks);
  const merged: { startTime: string; text: string }[] = [];

  for (let i = 0; i < chunks.length; i += groupSize) {
    const group = chunks.slice(i, i + groupSize);
    if (group.length === 0) continue;
    merged.push({
      startTime: group[0].startTime,
      text: group.map((c) => c.text).join(' ').trim(),
    });
  }

  return merged;
}

function formatSecondsToTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function chunkTranscriptItems(
  items: { text: string; start: number; duration: number }[],
  options?: { silenceGapSeconds?: number; minChunkSeconds?: number; maxChunkSeconds?: number }
): { startTime: string; text: string }[] {
  const silenceGapSeconds = options?.silenceGapSeconds ?? 1.5;
  const forceSplitGapSeconds = 5;
  const minChunkSeconds = options?.minChunkSeconds ?? 90;
  const maxChunkSeconds = options?.maxChunkSeconds ?? 5 * 60;

  if (!items || items.length === 0) return [];

  const chunks: { startTime: string; text: string }[] = [];

  let currentStart = items[0].start;
  let currentEnd = items[0].start + items[0].duration;
  let currentTextParts: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const itStart = it.start;
    const itEnd = it.start + it.duration;
    const next = i + 1 < items.length ? items[i + 1] : null;

    currentTextParts.push(it.text);
    currentEnd = Math.max(currentEnd, itEnd);

    const chunkDuration = currentEnd - currentStart;
    const gapToNext = next ? next.start - itEnd : 0;

    const shouldSplitBySilence = next ? gapToNext >= silenceGapSeconds : true;
    const shouldForceSplit = next ? gapToNext >= forceSplitGapSeconds : false;
    const shouldSplitByMax = chunkDuration >= maxChunkSeconds;
    const canSplitNow = chunkDuration >= minChunkSeconds;

    if (next && (shouldSplitByMax || shouldForceSplit || (shouldSplitBySilence && canSplitNow))) {
      chunks.push({
        startTime: formatSecondsToTimestamp(currentStart),
        text: currentTextParts.join(' ').trim(),
      });
      currentStart = next.start;
      currentEnd = next.start + next.duration;
      currentTextParts = [];
    }

    if (!next) {
      const finalText = currentTextParts.join(' ').trim();
      if (finalText) {
        chunks.push({ startTime: formatSecondsToTimestamp(currentStart), text: finalText });
      }
    }
  }

  return chunks;
}

async function summarizeChunk(chunk: { startTime: string, text: string }, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const prompt = `Below is a part of a YouTube video transcript.
Create a very short subtopic in Korean (1-4 words) that captures the main theme, then summarize the core content in exactly ONE concise Korean sentence.
Output format: 소주제  요약문장
Example: 주택 공급 확대  정부는 수도권 135만 채 공급 계획을 발표하고 있습니다.
Do NOT use brackets or labels. Output natural Korean text only.

Transcript:
${chunk.text}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const processedText = text.replace(/\n/g, '|||'); // Use a unique separator
    // Always prepend the correct timestamp from chunk
    return `${chunk.startTime} - ${processedText}`;
  } catch (e) {
    console.error(`Chunk summary failed for ${chunk.startTime}:`, e);
    return `${chunk.startTime} - [요약 실패]`;
  }
}

export async function analyzeContent(

  channelName: string,
  title: string,
  transcript: string,
  thumbnailUrl: string,
  duration?: string,
  transcriptItems?: { text: string; start: number; duration: number }[],
  publishedAt?: string
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

  const analysisProfile = getGeminiAnalysisProfile({
    durationIso: duration,
    transcript,
    transcriptItems,
  });

  // 썸네일 이미지 준비 (멀티모달 분석용)
  let thumbnailPart = null;
  if (thumbnailUrl) {
      console.log("Fetching thumbnail for analysis:", thumbnailUrl);
      thumbnailPart = await urlToGenerativePart(thumbnailUrl);
  }

  let subtitleSummaryOverride: string | null = null;
  try {
    const skipSmartSummary = shouldSkipSmartSummary({
      durationIso: duration,
      transcript,
      transcriptItems,
    });

    if (!skipSmartSummary) {
      const rawChunks = (transcriptItems && transcriptItems.length > 0)
        ? chunkTranscriptItems(transcriptItems)
        : (transcript && transcript.trim() ? chunkTranscript(transcript) : []);

      const chunks = coalesceChunks(rawChunks, 10);

      if (chunks.length > 0) {
        const summaries = await Promise.all(
          chunks.map(chunk => summarizeChunk(chunk, apiKey))
        );
        subtitleSummaryOverride = summaries.join("\n");
      }
    }
  } catch (e) {
    console.error("Smart chunk subtitle summary failed:", e);
    subtitleSummaryOverride = null;
  }

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
  const uploadDateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
    : null;

  const systemPrompt = `
    # 어그로필터 분석 AI용 프롬프트 (유튜브 생태계 분석가 모드)

    ## 시간 정보
    - 오늘(분석 시점): **${today}**
    - 영상 업로드일: **${uploadDateStr || '알 수 없음'}**
    제목에 연도가 포함된 경우, **영상 업로드 시점** 기준으로 과거/현재/미래를 판단하라. 업로드 당시 기준으로 현재이거나 과거인 연도는 '미래 시점'으로 간주하지 마라.
    
    ## 역할
    너는 엄격한 팩트체커가 아니라, **'유튜브 생태계 분석가'**다. 
    유튜브 특유의 표현 방식을 이해하되, 시청자가 실제로 **"속았다"**고 느끼는지 여부를 핵심 기준으로 점수를 매겨라.

    --- 

    ### **콘텐츠 유형별 평가 가이드 (매우 중요)**

    **1. 콘텐츠 목적 파악 (Analyze Content's Primary Purpose First)**
    분석을 시작하기 전, 영상의 주된 목적이 **'정보 전달'**인지 **'경험 제공'**인지 먼저 판단하십시오.

    -   **정보 전달 (Information-Providing):** 뉴스, 리뷰, 튜토리얼, 지식/상식, 건강 정보 등 사실과 데이터가 중요한 콘텐츠.
    -   **경험 제공 (Experience-Providing):** 음악, 영화/드라마, 단편 필름, 브이로그, 개그/코미디, 반려동물 영상 등 감성적/예술적/오락적 경험이 중요한 콘텐츠.

    **2. 평가 기준 적용 (Apply Differentiated Criteria)**

    **A. '정보 전달' 콘텐츠 평가:**
    -   **정확성:** 기존과 같이 사실관계, 데이터의 정확성, 출처의 신뢰성을 엄격하게 평가합니다. 제목/썸네일과 실제 내용의 사실적 일치 여부가 핵심입니다.
    -   **어그로성:** 과장, 허위, 자극적인 표현을 엄격하게 평가합니다.

    **B. '경험 제공' 콘텐츠 평가:**
    -   **정확성 (Thematic Consistency):** '사실적 정확성'이 아닌 **'주제적 일관성'**을 기준으로 평가합니다.
        -   **높은 점수 (90-100점):** 제목과 썸네일이 암시하는 감성, 분위기, 주제(예: '슬픈 강아지 이야기', '신나는 여름 노래')가 실제 영상의 경험과 일치하는 경우. 공식 뮤직비디오가 제목과 일치하는 노래를 제공하는 경우.
        -   **낮은 점수 (0-30점):** 제목/썸네일이 약속한 감성/주제와 영상의 실제 경험이 완전히 다른 경우. (예: 감동적인 제목의 영상이 실제로는 공포 영상인 경우)
    -   **어그로성 (Deceptive Elements):**
        -   경험의 본질을 속이는 행위에 집중합니다. (예: '유명인 OOO 출연!'이라고 했으나 실제로는 등장하지 않는 경우)
        -   단순 조회수 유도 문구(예: '200만 뷰 돌파')는 경험의 본질을 해치지 않는다면, 어그로 점수를 약간만(10-20점) 부여하여 신뢰도에 미치는 영향을 최소화합니다.
        -   **핵심:** 시청자가 '속았다'는 느낌보다 '낚였다'는 가벼운 느낌을 받는 수준의 마케팅 요소는 관대하게 평가합니다.

    --- 

    ## 분석 및 채점 기준 (Scoring Rubric) - [위 가이드를 먼저 적용 후, 세부 점수 산정 시 참고]
    0점(Clean)에서 100점(Aggro) 사이로 어그로 점수를 매길 때, 아래 기준을 엄격히 따라라.
    
    1. 정확성 점수 (Accuracy Score) - **[선행 평가]**
    - **(중요)** 위 '콘텐츠 유형별 평가 가이드'에 따라, '정보 전달' 콘텐츠는 **사실 기반 정확성**을, '경험 제공' 콘텐츠는 **주제적 일관성**을 기준으로 0~100점 평가하라.

    2. 어그로 지수 (Clickbait Score) - **[Fact-Based Gap Analysis]** 🎯
    - **핵심 원칙**: 어그로 점수는 단순한 '표현의 자극성'이 아니라, '제목/썸네일이 약속한 내용'과 '실제 영상 내용' 사이의 **불일치(Gap)** 정도를 기준으로 산정한다.

    - **상세 점수 기준 (The Gap Scale)**:
        - **0~20점 (일치/Marketing)**: [Gap 없음 - 피해 없음] 제목이 자극적이어도 내용이 이를 충분히 뒷받침함. (유튜브 문법상 허용되는 마케팅)
        - **21~40점 (과장/Exaggerated)**: [시간적 피해 (Time Loss)] 작은 사실을 침소봉대하여 시청자의 시간을 낭비하게 함. 핵심 팩트는 있으나 부풀려짐.
        - **41~60점 (왜곡/Distorted)**: [정신적 피해 (Mental Fatigue)] 문맥을 비틀거나 엉뚱한 결론을 내어 시청자에게 혼란과 짜증 유발. 정보 가치 낮음.
        - **61~100점 (허위/Fabricated)**: [실질적 피해 (Loss)] 없는 사실 날조, 사기성 정보. 심각한 오해나 실질적 손실 초래 가능.

    **[논리 일치성 절대 준수]**
    - 자극적인 표현('미쳤다', '방금 터졌다' 등)이 있더라도 내용이 사실이면 어그로 점수를 낮게 책정하라.
    - 텍스트 평가와 수치(점수)의 논리적 일관성을 반드시 유지하라.

    **[평가 이유(evaluationReason) 작성 강제 규칙 - 매우 중요]**
    - 아래 4개 구간 라벨 중 하나를 반드시 선택해라(다른 표현 금지):
      - '일치/마케팅/훅'
      - '과장(오해/시간적 피해/낚임 수준)'
      - '왜곡(혼란/짜증)'
      - '허위/조작(실질 손실 가능)'
    - 위 라벨을 JSON의 clickbaitTierLabel 필드에 반드시 포함해라.
    - evaluationReason의 "2. 어그로성 평가" 본문은 반드시 다음 문장으로 시작해야 한다(문구 정확히 준수):
      - 이 점수는 '[clickbaitTierLabel]' 구간입니다.
    - 점수가 21~40(과장)인데도 '피해 없음/마케팅 수준'처럼 서술하는 등의 모순은 절대 금지한다.
    
    ## 분석 지침 (Critical Instructions)
    1. **수치 데이터 분석 정확도**: 억, 만 등 단위가 포함된 숫자를 철저히 계산하라. 예: 282억 원은 '수백억'대이지 '수십억'대가 아니다. 단위 혼동으로 인한 오판을 절대 하지 마라.
    2. **내부 로직 보안**: 분석 사유 작성 시 "정확도 점수가 70점 이상이므로 어그로 점수를 낮게 책정한다"와 같은 **시스템 내부 채점 규칙이나 로직을 시청자에게 직접 언급하지 마라.** 시청자에게는 오직 영상의 내용과 제목 간의 관계를 바탕으로 한 결과론적 사유만 설명하라.
    3. **타임스탬프 요약 가이드 (절대 규칙)**:
        - **자막 전수 분석**: 입력된 자막 데이터의 처음부터 끝까지 단 한 줄도 빠짐없이 읽고 분석하라.
        - **종료 시점 일치**: 요약의 마지막 타임스탬프는 반드시 제공된 영상의 전체 길이(duration) 또는 자막의 마지막 시점과 일치해야 한다. (예: 2분 16초 영상이면 마지막 요약은 반드시 2:10~2:16 사이여야 함).
        - **중간 생략 금지**: 영상 중간에서 요약을 멈추는 행위는 심각한 오류로 간주한다. 전체 내용을 균등하게 배분하여 요약하라.
        - **형식**: '0:00 - 소주제: 요약내용' (특수문자/마크다운 금지).
        - **가변 분할**: 영상 길이에 따라 요약 개수를 조절하되, 영상 전체 맥락을 촘촘히 연결하라.
    
    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 포함하지 말 것.
    - **중요**: evaluationReason 내의 각 항목 제목(1, 2, 3번) 뒤에는 반드시 한 번의 줄바꿈(<br />)을 넣어 제목과 본문을 분리하라.
    - **중요**: 각 항목의 본문 내부에서는 소문단 구분을 위한 추가적인 줄바꿈(\n)이나 <br />을 절대 사용하지 마라. 본문은 하나의 연속된 문단으로 작성하라.
    - **중요**: 항목 간의 구분을 위해서만 <br /><br /> 태그를 사용하라.
    - **중요**: subtitleSummary 및 evaluationReason 내에서 따옴표(")나 줄바꿈(\n) 사용 시 반드시 적절히 이스케이프 처리하여 JSON 문법 오류를 방지하라.
    
    {
      "accuracy": 0-100,
      "clickbait": 0-100,
      "reliability": 0-100,
      "clickbaitTierLabel": "일치/마케팅/훅|과장(오해/시간적 피해/낚임 수준)|왜곡(혼란/짜증)|허위/조작(실질 손실 가능)",
      "subtitleSummary": "0:00 - 소주제: 요약내용\\n5:00 - 소주제: 요약내용\\n...",
      "evaluationReason": "1. 내용 정확성 검증 (XX점):<br />내용...<br /><br />2. 어그로성 평가 (XX점):<br />내용...<br /><br />3. 신뢰도 총평 (XX점 / 🟢Green):<br />내용...",
      "overallAssessment": "전반적인 평가",
      "recommendedTitle": "추천 제목"
    }

    **[신뢰도 총평 판정 기준]**:
    - 🟢 Green: 70점 이상
    - 🟡 Yellow: 40~69점
    - 🔴 Red: 39점 이하
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
    
    const result = await generateContentWithRetry(model, inputs, {
      timeoutMs: analysisProfile.timeoutMs,
      maxRetries: analysisProfile.retries,
      baseDelayMs: analysisProfile.baseDelayMs,
    });
    
    // Validate response immediately to trigger fallback if blocked/empty
    const response = await result.response;
    const text = response.text();
    console.log("Raw AI Response:", text);
    if (!text) throw new Error("Empty response from AI (Likely Safety Block)");
    
    return result;
  };

  try {
    let result;
    // Strategy: Primary model + safe fallback
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash"];
    
    let lastError;
    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting analysis with model: ${modelName}`);
        result = await tryModel(modelName);
        if (result) break; // Success
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ Model ${modelName} failed: ${error.message}`);
        
        // Small backoff before next model attempt on transient failures
        const msg = String(error?.message || '');
        const isTransient =
          msg.includes('timeout') ||
          msg.includes('429') ||
          msg.toLowerCase().includes('quota') ||
          msg.includes('503') ||
          msg.toLowerCase().includes('overloaded');

        if (isTransient) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
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

    if (subtitleSummaryOverride) {
      analysisData.subtitleSummary = subtitleSummaryOverride;
    }

    // [Final Safety Check] 삭제
    // standardizeTopic 호출 및 관련 로직 제거
    // -----------------------------------

    return analysisData;

  } catch (error: any) {
    console.error("Gemini Analysis Error Full Details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw error;
  }
}
