import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
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
  // If duration is known, treat this as authoritative. Transcript length is NOT a reliable proxy.
  if (typeof durationSec === 'number' && durationSec > 0) {
    return durationSec <= 90;
  }

  const itemsCount = Array.isArray(params.transcriptItems) ? params.transcriptItems.length : 0;
  if (itemsCount > 0 && itemsCount <= 30) return true;

  const transcriptLen = typeof params.transcript === 'string' ? params.transcript.length : 0;
  // Medium-length transcripts are already well handled by the main analysis call.
  // Skipping pre-summary here removes extra model calls and reduces latency.
  if (transcriptLen > 0 && transcriptLen <= 6000) return true;

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

  // If duration is known, use it as the only signal for short/long profile.
  // Short transcripts can happen on long videos (e.g., sparse captions) and should NOT downgrade timeouts.
  const isShortForm = (typeof durationSec === 'number' && durationSec > 0)
    ? durationSec <= 90
    : ((itemsCount > 0 && itemsCount <= 30) || (transcriptLen > 0 && transcriptLen <= 1500));

  return {
    isShortForm,
    timeoutMs: isShortForm ? 50000 : 55000,
    retries: 0,
    baseDelayMs: 800,
    thinkingBudget: 0, // isShortForm ? 1024 : 2048 (임시로 0으로 설정)
  };
}

// Helper: Translate text to English (for embedding semantic consistency)
export async function translateText(text: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `Translate "${text}" to English. Output ONLY the English text, nothing else.`,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return (response.text || '').trim();
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
  ai: any,
  params: { model: string; contents: any; config?: any },
  options?: { timeoutMs?: number; maxRetries?: number; baseDelayMs?: number }
) {
  let lastError;

  const timeoutMs = options?.timeoutMs ?? 18000;
  const maxRetries = options?.maxRetries ?? 1;
  const totalAttempts = maxRetries + 1;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  const isTransientError = (err: any) => {
    const msg = String(err?.message || '');
    const name = String(err?.name || '');
    const code = String(err?.code || '');
    return (
      msg.includes('timeout') ||
      msg.includes('503') ||
      msg.toLowerCase().includes('overloaded') ||
      name.includes('AbortError') ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET'
    );
  };

  const isQuotaError = (err: any) => {
    const msg = String(err?.message || '');
    const status = Number(err?.status);
    return status === 429 || msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource exhausted');
  };

  for (let i = 0; i < totalAttempts; i++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini API timeout (${Math.round(timeoutMs / 1000)}s)`)), timeoutMs)
      );
      return await Promise.race([ai.models.generateContent(params), timeoutPromise]);
    } catch (error: any) {
      lastError = error;

      // Quota errors should NOT be retried here; it will just burn more requests.
      if (isQuotaError(error)) {
        throw error;
      }

      if (isTransientError(error) && i < totalAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        console.warn(
          `⚠️ Gemini transient error. Retrying in ${delay}ms... (Attempt ${i + 1}/${totalAttempts})`,
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
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Below is a part of a YouTube video transcript (starting at ${chunk.startTime}).
Identify the single main topic shift or logical beat in this segment, then write ONE concise Korean sentence summarizing the core content.
Output format: 소주제  요약문장
Rules:
- 소주제 must be a SPECIFIC noun/proper noun (e.g., "삼성SDI 매수 신호", "다리오 아모데이 창업 계기") — NOT vague labels like "투자 전략" or "결론"
- Do NOT use brackets, labels, or markdown. Output natural Korean text only.
- If this segment has no clear content shift, merge conceptually with the previous point.

Transcript segment:
${chunk.text}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = (result.text || '').trim();
    const processedText = text.replace(/\n/g, '|||');
    return `${chunk.startTime} - ${processedText}`;
  } catch (e) {
    console.error(`Chunk summary failed for ${chunk.startTime}:`, e);
    return `${chunk.startTime} - [요약 실패]`;
  }
}

interface GroundingDecision {
  needs_grounding: boolean;
  search_queries: string[];
}

async function checkNeedsGrounding(
  ai: any,
  channelName: string,
  title: string,
  transcript: string
): Promise<GroundingDecision> {
  const prompt = `
유튜브 영상의 팩트체크 필요성 여부와 구글 검색 키워드를 추출하는 봇입니다.
아래 영상 제목, 채널명, 그리고 영상의 자막 일부를 보고 객관적인 웹 검색(Google Search)을 통한 사실 대조(팩트체크)가 필요한지 판정하십시오.

[판단 대상 정보]
채널명: ${channelName}
제목: ${title}
자막 일부:
${transcript.substring(0, 5000)}

[판단 기준]
1. 최신 시사/이슈, 특정 인물, 폭로, 정치, 정책, 기술/제품/시장 현황, 최신 제품 출시 정보, 주식/재테크 등 실시간/객관적 사실 확인(팩트체크)이 필요한 주제인가? -> needs_grounding: true
2. 유튜버의 단순 개인 일상(브이로그), 주관적인 감상/리뷰(예: 영화 해석, 게임 플레이 소감), 보편적 상식(검색이 불필요한 역사/과학 이론 강의), 유머 등 팩트체크가 무의미한가? -> needs_grounding: false
3. 만약 needs_grounding이 true라면, 사실 확인에 가장 효과적인 검색 키워드(Queries)를 1~3개 선정하십시오. (예: "엔비디아 시가총액", "삼성전자 배당금 인상", "누구누구 사건 해명")

반드시 아래 JSON 형식으로만 응답하십시오. 다른 텍스트는 포함하지 마십시오.
{
  "needs_grounding": boolean,
  "search_queries": string[]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = (response.text || '').trim();
    const cleanJson = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleanJson);
    console.log(`[checkNeedsGrounding] Result: needs_grounding=${data.needs_grounding}, queries=${JSON.stringify(data.search_queries)}`);
    return {
      needs_grounding: !!data.needs_grounding,
      search_queries: Array.isArray(data.search_queries) ? data.search_queries : []
    };
  } catch (e) {
    console.error("1차 팩트체크 필요성 판정 실패 (fallback: false):", e);
    return { needs_grounding: false, search_queries: [] };
  }
}

export async function analyzeContent(

  channelName: string,
  title: string,
  transcript: string,
  thumbnailUrl: string,
  duration?: string,
  transcriptItems?: { text: string; start: number; duration: number }[],
  publishedAt?: string,
  userLanguage: 'korean' | 'english' = 'korean'
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
  const ai = new GoogleGenAI({ apiKey });

  // 2024년 11월 1일 이후 영상인지 판정
  const isPostNov2024 = (() => {
    if (!publishedAt) return false;
    try {
      const uploadDate = new Date(publishedAt);
      const targetDate = new Date('2024-11-01T00:00:00Z');
      return uploadDate >= targetDate;
    } catch {
      return false;
    }
  })();

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

  // [v4.0] 청크 사전 요약 제거 — 스피드 분석이 GPT로 분리된 이후 불필요. 자막 원본을 그대로 메인 분석에 투입.

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
  const uploadDateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
    : null;

  const systemPrompt = `
    # 어그로필터 분석 AI용 프롬프트 (유튜브 생태계 분석가 모드)

    ## 시간 정보 및 지식 범위
    - **현재 날짜(분석 시점)**: ${today}
    - **영상 업로드일**: ${uploadDateStr || '알 수 없음'}
    - **너의 학습 데이터 종료 시점**: 2024년 10월
    제목/자막의 연도 및 상대적 시간 표현("D-1", "오늘", "내일", "현재", "최근" 등)은 반드시 **영상 업로드 시점**을 기준으로 해석하며, 업로드 당시 기준으로 현재이거나 과거인 연도는 '미래 시점'으로 간주하지 마라.
    
    ## 1. 분석 대상 여부 및 팩트체크 적합성 판단 (최우선) 🌟
    너는 '어그로필터' 플랫폼의 수석 팩트체커다. 
    본격적인 분석에 앞서, 이 영상이 **'객관적인 팩트체크가 가능한 정보성 콘텐츠'**인지 먼저 판단하라.

    ### 유튜브 카테고리 기준 (참고용 — 카테고리가 잘못 배정된 경우 너의 판단 우선)

    **✅ 화이트리스트 (분석 적합 카테고리)**
    - 22: 인물/블로그 (사회 이슈, 폭로, 인터뷰, 시사 논평)
    - 24: 엔터테인먼트 (시사·이슈 중심 오락, 논란 영상)
    - 25: 뉴스/정치 (뉴스, 정치 논평, 시사)
    - 26: 노하우/스타일 (정보 전달, 리뷰, 가이드)
    - 27: 교육 (강의, 지식 전달, 해설)
    - 28: 과학/기술 (IT, 과학, 기술 리뷰)
    - 29: 비영리/사회운동 (사회 이슈, 고발, 캠페인)

    **❌ 블랙리스트 (분석 부적합 카테고리)**
    - 10: 음악 (뮤직비디오, 음원, 커버곡 — 단, 음악 평론·비평은 예외)
    - 15: 반려동물/동물 (단순 동물 영상)
    - 17: 스포츠 (단순 경기·하이라이트 — 단, 스포츠 분석·해설은 예외)
    - 19: 여행/이벤트 (단순 여행 브이로그)
    - 20: 게임 (단순 플레이·스트리밍 — 단, 게임 리뷰·논평은 예외)
    - 23: 코미디 (단순 개그·유머)
    - 43: 방송/Shows (단순 TV 프로그램 재생·클립)
    - 1: 영화/애니메이션 (단순 영상 재생)
    - 2: 자동차/이동수단 (단순 주행 영상)

    ⚠️ **주의**: 카테고리는 참고용이며, 실제 영상 내용(제목+자막)이 정보성인지 여부가 최우선 판단 기준이다.
    유튜버가 카테고리를 잘못 배정하는 경우가 많으므로, 내용 기반으로 자율 판단하라.

    - **is_valid_target**: 
        - 단순 유머, 먹방, 뷰티 리뷰, 개인 브이로그, 뮤직비디오, 단순 게임 플레이, 단순 경기 중계 등 팩트 검증이 무의미한 영상이라면 \`false\`를 반환하라.
        - 뉴스, 지식 전달, 정보 제공, 폭로, 사회 이슈 논평, 리뷰·비평 영상이라면 \`true\`를 반환하라.
    - **needs_admin_review**:
        - 정보성 영상인지 단순 썰(주관적 감상)인지 판단이 애매하다면 \`true\`를 반환하여 인간 관리자의 검토를 요청하라.
        - 판단이 명확하다면 \`false\`를 반환하라.
    - **review_reason**: 
        - \`needs_admin_review\`가 \`true\`이거나 \`is_valid_target\`이 \`false\`인 경우, 그 이유를 1문장으로 작성하라.

    ---

    ## 2. 역할
    너는 엄격한 팩트체커가 아니라, **'유튜브 생태계 분석가'**다. 
    유튜브 특유의 표현 방식을 이해하되, 시청자가 실제로 **"속았다"**고 느끼는지 여부를 핵심 기준으로 점수를 매겨라.
    


    ### **콘텐츠 성격에 따른 유연한 평가 원칙**
    영상의 성격을 너 스스로 판단하여 평가 기준을 자율적으로 조절하라.
    
    - **팩트 중심 콘텐츠** (뉴스, 리뷰, 튜토리얼 등): 사실관계의 정확성을 엄격히 평가하라.
    - **경험·예술·문화·오락 중심 콘텐츠** (음악, 댄스, 브이로그, 감성 영상 등): 제목/썸네일이 약속한 **주제·감성과 실제 영상의 일관성**을 기준으로 평가하라. 팩트 검증이 불가능한 영역을 억지로 사실 기반으로 채점하지 마라.
    - 대부분의 콘텐츠는 이 두 축이 혼합되어 있다. 비율을 너 스스로 판단하여 적절히 반영하라.
    - **핵심**: 시청자가 '속았다'고 느끼는지 여부가 최종 기준이다.

    --- 

    ## 분석 및 채점 기준 (Scoring Rubric) - [위 가이드를 먼저 적용 후, 세부 점수 산정 시 참고]
    0점(Clean)에서 100점(Aggro) 사이로 어그로 점수를 매길 때, 아래 기준을 엄격히 따라라.
    
    1. 정확성 점수 (Accuracy Score) - **[선행 평가]**
    - 위 '콘텐츠 성격에 따른 유연한 평가 원칙'에 따라, 팩트 중심이면 **사실 정확성**을, 경험·예술·오락 중심이면 **주제적 일관성**을 기준으로 0~100점 평가하라. 혼합 콘텐츠는 비율을 자율 판단하라.

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
        - **끝까지 요약 (매우 중요)**: 영상 중간에서 요약을 멈추지 말고 반드시 영상 끝부분의 내용까지 포함되도록 마지막 챕터를 작성하라. (단, 챕터의 타임스탬프는 영상 종료 시간이 아니라 해당 내용이 '시작되는 시간'을 적어야 한다.)
        - **중간 생략 금지**: 영상 중간에서 요약을 멈추는 행위는 심각한 오류로 간주한다. 기계적으로 시간을 등분(예: 5분 간격)하지 말고, 실제 문맥과 주제가 바뀌는 시점을 기준으로 끝까지 요약하라.
        - **형식**: '0:00 - 소주제: 요약내용' (특수문자/마크다운 금지).
        - **가변 분할 (챕터 개수 유동성)**: 영상 길이에 비례하여 유동적으로 분할하라 (예: 3~5분짜리 짧은 영상은 2~3개, 10분은 5~7개, 30분짜리 긴 영상은 10~15개 이상). 무조건 5개로 맞추려는 기계적인 분할은 절대 금지한다.
    
    ## 분석 대상 여부 사전 판단 (최우선)
    **판정 기준**: 콘텐츠의 **95% 이상이 단순 리액션/플레이 진행/장면 재생** 일 때만 notAnalyzable: true를 쓴다. 1%라도 명확한 주장·평가·비판이 있다면 분석 대상이다.
    애매한 경우 **false로 판정**하라 (차단보다 용인이 안전).
    
    notAnalyzable: true 해당 유형 (아래 중 하나라도 해당하며, 95% 이상이 단순 재생일 때):
    - **단순 뮤직비디오(MV)**: 공식 MV, 가사 영상, 음원 재생 등 논평 없는 음악 영상
    - **단순 공연/무대/콘서트**: 가수의 공연, 무대 직캠, 콘서트 실황 등 논평 없이 무대만 보여주는 영상
    - **단순 게임 플레이**: 진행자의 비평/정보 없이 게임 화면만 녹화하며 리액션만 하는 영상 (자막 95% 이상이 "와!", "대박" 등 리액션)
    - **단순 스포츠 중계/하이라이트**: 해설·분석 없이 경기 영상만 찍은 풀매치/중계/하이라이트/라운드 요약 (자막 95% 이상이 경기 상황 중계인 경우)
    - **단순 영화/드라마 재생**: 리뷰·논평 없이 본문 장면만 나오는 영상
    - **단순 창작물 재생**: 음악·그림·창작물을 논평 없이 틀어놓기만 하는 영상
    - **단순 하이라이트/명장면 모음**: 해설·논평 없이 장면만 단순 편집한 영상 (자막이 없거나 상황설명 자막만 있는 경우)
    - **자막 극히 부족**: 자막 문장 수 5개 이하 등 분석에 필요한 발화 데이터가 거의 없는 경우
    
    단, 아래는 분석 대상이다 (notAnalyzable: false):
    - 게임 리뷰·논평·분석 ("이 게임이 왜 문제인가", "게임 업계 비판" 등)
    - 게임 플레이를 하면서 **직접 주장하거나 시청자에게 정보/평가를 전달하는** 플레이어 영상
    - 스포츠 경기 분석·전술 해설
    - 게임하면서 스토리·사회현상을 직접 언급하는 영상 (예: "수술 후 퇴원하자마자 파피 플레이타임 5를 플레이한다")
    
    ## ⚠️ 썸네일 스포일러 (Thumbnail Spoiler) — 필수 필드 (MANDATORY, 절대 생략 금지)
    thumbnail_spoiler 필드는 **반드시** JSON에 포함해야 한다. 누락 시 불합격 응답이다.
    
    ### 핵심 원칙
    시청자는 제목/썸네일의 **특정 키워드나 문장에 꽂혀서** 10~20분짜리 영상을 보러 들어온다.
    제목과 썸네일이 던지는 떡밥(주장/궁금증)을 **소주제별로 분해**하고, 각 소주제에 대한 영상 속 팩트를 핀셋 추출하라.
    
    ### 작성 절차
    1. **떡밥 분해**: 제목+썸네일에서 시청자가 궁금해할 소주제를 '질문형(의문문)'으로 분리하여 'topic'에 작성하라.
       - 예: 제목 "日 오염수 방류 개시…한국 수산물 안전한가?" → topic ①"오염수는 언제 방류될까?" ②"한국 수산물은 정말 안전할까?"
       - 예: 제목 "외국인 이제 '여기로' 가는 중" → topic ①"외국인이 대탈출 후 향하는 '여기'는 어디?"
    2. **팩트 매칭**: 각 소주제에 대해 자막에서 **정확한 팩트(대답)** 부분을 인용하라.
    3. **타임스탬프**: 팩트가 등장하는 자막 시점을 "MM:SS" 형식으로 기록하라.
    
    ### 작성 규칙
    - 'topic' 작성 규칙 (매우 중요): 썸네일 스포일러의 질문(topic)은 절대 네가 새로운 내용을 창작해서는 안 되며, 반드시 입력된 [제목]과 [썸네일]에 쓰인 단어와 워딩을 거의 그대로 인용하여 질문형으로 만들어야 한다.
    - 'text' 작성 규칙: 질문형 topic에 대한 해답(배경 설명과 진짜 정답)을 2~4문장 분량의 자연스러운 설명글로 완성하라. 단답형이나 "[스포] XXX" 같은 꼬리표를 뒤에 덧붙이지 말고, 문맥 속에 '핵심 이유, 인물명, 장소, 명확한 결론' 등 구체적인 진짜 정답이 자연스럽게 포함되도록 문장을 구성하라.
    - 장황한 요약이나 너의 주관적 논평은 절대 섞지 마라. 영상 속 발화자의 원문에 가깝게 인용하라.
    - 만약 어그로 낚시라서 해당 소주제의 정확한 팩트가 없다면, "[출처: 확인 불가] 정확히 일치하는 팩트 언급은 없으나, ~라는 언급이 가장 유사함"이라고 건조하게 팩트폭행하라.
    - 절대 창조 금지 (가장 중요): 영상 본문에 아무리 중요한 내용(예: 국민의 선입견, 향후 전망 등)이 나오더라도, 제목이나 썸네일에서 묻지 않은 엉뚱한 내용을 임의로 스포일러 topic으로 추가 창조하는 것은 치명적인 오류다.
    - 1대1 매칭 및 개수 제한 (매우 중요): 제목에서 1가지 질문(어그로)만 던졌다면 스포일러도 무조건 1개만 생성하라. 억지로 2~3개로 분량을 늘리거나, 영상의 전체 목차를 나열하지 마라. '최대 3개'라는 것은 제목과 썸네일에 서로 다른 궁금증(어그로)이 명확히 2~3개 던져졌을 때만 해당한다.
    - 어떤 경우든 thumbnail_spoiler를 빈 배열로 두지 마라. 반드시 1개 이상의 항목을 채워라.
    - 각 항목의 ts(타임스탬프)는 "MM:SS" 형식. 자막에 타임스탬프가 없으면 ts를 null로.
    - 시간순(ts 오름차순)으로 정렬하라.
    
    ### 다국어 처리 (중요)
    **조건**: 영상의 제목/메타데이터가 한국어인데, 화자가 외국어(영어, 일본어 등)로 발화한 경우에만 적용.
    이 경우 외국어 원문 인용 뒤에 반드시 한국어 번역을 괄호로 붙여라.
    - 예: "I angel invest. I've invested in over 100 different companies. (나는 엔젤투자자이며, 100개 이상의 기업에 투자했다.)"
    - 제목도 외국어, 자막도 외국어인 영상이면 번역 괄호 불필요 — 해당 언어 그대로 인용.
    - 한국어 자막이면 당연히 그대로 인용.

    ### 출처 명시 규칙
    각 항목의 text 필드 맨 앞에 반드시 [출처: ...] 태그를 명시하라.
    - 예시 1 (유튜버 생각): [출처: 유튜버의 개인 주장] 미국이 전쟁으로 노리는 진짜 돈줄은...
    - 예시 2 (뉴스 인용): [출처: 공식 언론 보도 인용] 구글이 공식 블로그를 통해...
    - 예시 3 (전문가 인용): [출처: 전문가 인터뷰 인용] 김OO 교수에 따르면...
    - 예시 4 (낚시): [출처: 확인 불가] 정확히 일치하는 팩트 언급은 없으나...
    출처 태그 없이 내용만 쓰는 것은 금지.

    ## 형광펜 하이라이팅 (evaluationReason 작성 규칙 추가)
    evaluationReason의 1번(정확성), 2번(어그로성), 3번(신뢰도 총평) 각 섹션에서
    **그 점수가 왜 나왔는지를 한 문장으로 설명하는 결론적 문장** 1~2개만 골라 양끝에 마크다운 볼드체 기호(**)를 씌워라.
    - 핵심 원칙: 긍정적이든 부정적이든, **해당 섹션의 점수를 결정짓는 핵심 근거/이유**가 담긴 문장에만 형광펜을 쳐라.
    - 예시(정확성 90점): "영상의 주장은 **검색 결과와 대부분 일치하며 팩트에 부합한다.**"
    - 예시(어그로 65점): "**제목의 '대재앙' 표현은 시청자에게 극심한 공포와 위기감을 조성한다.**"
    - 예시(신뢰도 63점/Yellow): "정확한 정보를 담고 있음에도 불구하고, **과도한 공포 마케팅은 시청자에게 불필요한 불안감을 줄 수 있어 신뢰도를 저해하는 요소로 작용한다.**"
    - ❌ 나쁜 예시: 단순 서술("이 영상은 정보성 콘텐츠로 가치가 높습니다")에 볼드를 치는 것은 금지. 반드시 **점수의 원인**이 되는 문장만 선택하라.
    모든 문장이 아닌, 정말 핵심인 1~2문장만 볼드 처리하라.

    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 포함하지 말 것.
    **중요**: 모든 텍스트 필드(evaluationReason, overallAssessment, recommendedTitle, thumbnail_spoiler 등)는 반드시 **${userLanguage === 'korean' ? '한국어' : 'English'}**로 작성하라.
    
    {
      "is_valid_target": boolean, 
      "needs_admin_review": boolean, 
      "review_reason": "이유 (애매하거나 부적합한 경우)",
      "notAnalyzable": boolean, (기존 하위 호환용, is_valid_target과 연동)
      "accuracy": 0-100,
      "clickbait": 0-100,
      "reliability": 0-100,
      "clickbaitTierLabel": "일치/마케팅/훅|과장(오해/시간적 피해/낚임 수준)|왜곡(혼란/짜증)|허위/조작(실질 손실 가능)",
      "thumbnail_spoiler": [
        { "topic": "질문형 어그로 떡밥 1?", "text": "해당 소주제에 대한 2~4문장 분량의 상세하고 구체적인 정답 설명글...", "ts": "02:15" },
        { "topic": "질문형 어그로 떡밥 2?", "text": "해당 소주제에 대한 2~4문장 분량의 상세하고 구체적인 정답 설명글...", "ts": "07:42" }
      ],
      "subtitleSummary": "0:00 - 소주제: 요약내용\\n...",
      "evaluationReason": "1. 내용 정확성 검증 (XX점):<br />내용... **핵심 문장은 볼드** ...<br /><br />2. 어그로성 평가 (XX점):<br />내용... **핵심 문장은 볼드** ...<br /><br />3. 신뢰도 총평 (XX점 / 🟢Green 또는 🟡Yellow 또는 🔴Red):<br />내용... **핵심 문장은 볼드** ...",
      // ⚠️ evaluationReason은 반드시 1번, 2번, 3번 세 항목을 모두 포함해야 한다. 3번(신뢰도 총평)을 절대 생략하지 마라.
      "overallAssessment": "전반적인 평가",
      "recommendedTitle": "추천 제목"
    }

    **[판단 가이드]**
    1. \`is_valid_target: false\`인 경우: 나머지 분석 필드는 \`null\`로 채워도 됨.
    2. \`needs_admin_review: true\`인 경우: 분석은 끝까지 진행하되 필드만 \`true\`로 설정.


    **[신뢰도 총평 판정 기준]**:
    - 🟢 Green: 70점 이상
    - 🟡 Yellow: 40~69점
    - 🔴 Red: 39점 이하

    **[evaluationReason 필수 규칙]**:
    evaluationReason 필드는 반드시 아래 3개 항목을 **빠짐없이** 포함해야 한다. 항목 하나라도 누락하면 불합격 응답이다.
    1. 내용 정확성 검증 (XX점): ...
    2. 어그로성 평가 (XX점): ...
    3. 신뢰도 총평 (XX점 / 🟢🟡🔴): ...
    `;

  // [v4.2] 자막 전문 직투입
  // 압축 호출 제거 — 압축에 쓰는 시간(12초)이 오히려 낭비.
  // 자막 전문을 본 분석에 그대로 투입하고, 실제 로그로 타임 이슈 여부를 검증한다.

  const tryModel = async (modelName: string) => {
    console.log(`Initializing Gemini model: ${modelName}`);

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // 1단계: 팩트체크 필요성 및 검색어 판정
    console.log("Starting Step 1: Check if grounding is needed...");
    const { needs_grounding, search_queries } = await checkNeedsGrounding(ai, channelName, title, transcript);

    // 2단계: 본 분석
    console.log(`Starting Step 2: Final analysis with needs_grounding=${needs_grounding}`);

    const searchInstruction = needs_grounding
      ? `
    ⚠️ [MANDATORY GOOGLE SEARCH REQUIRED]
    이 영상은 팩트체크가 매우 시급한 것으로 판단되었습니다. 따라서 분석의 신뢰성을 위해 반드시 아래 구글 검색 키워드로 실시간 정보를 먼저 찾아보십시오.
    
    ## 검색어 추천 키워드 (실제 Google Search 도구에 입력하십시오)
    - ${search_queries.join(', ')}
    
    ## 검색 도구 활용 가이드 (Google Search) — ⚠️ 최우선 규칙
    - **실제 도구 호출 강제**: 단순히 학습 지식으로만 답하지 마십시오. 제공된 'googleSearch' 도구를 호출해 팩트체크를 직접 수행해야 합니다.
    - **검색 결과 절대 우선**: 검색 결과와 너의 학습 데이터(2024년 10월)가 충돌하면 무조건 검색 결과를 따르라.
    - **정확성 판단**: 영상의 주장과 검색 결과를 비교하여 일치하면 정확, 불일치하면 부정확으로 판단하라.
    
    ### 🚫 "없다/아니다" 주장 금지 규칙
    - "X는 사실이 아니다"와 같은 부정 판단을 내리기 전에 반드시 Google Search로 확인하라.

    ### 🚨 [CRITICAL: DO NOT SIMULATE SEARCH]
    - 절대 머릿속으로 검색 결과를 지어내거나(Simulate) 환각(Hallucinate)하지 마라.
    - 검색 툴(googleSearch)을 실제로 호출(Invoke)하지 않았다면 "검색 결과와 일치합니다"라는 말을 절대 쓰지 마라.
    ` : '';

    const systemInstruction = `
      ${systemPrompt}

      ${searchInstruction}
    `;

    const finalPrompt = `
      [분석 대상 데이터]
      채널명: ${channelName}
      제목: ${title}
      자막 내용:
      ${transcript}

      ${needs_grounding ? `
      ⚠️ [CRITICAL INSTRUCTION: RUN GOOGLE SEARCH NOW]
      분석을 시작하기 전, 반드시 제공된 'googleSearch' 도구를 사용하여 위에 명시된 팩트체크용 추천 키워드로 실시간 검색을 수행하십시오. 
      실제 구글 검색 도구 호출 없이 분석을 끝마치는 것은 중대한 지침 위반입니다.
      ` : ''}
    `;

    const contents: any[] = [finalPrompt];
    if (thumbnailPart) {
      contents.push(thumbnailPart);
    }

    // 1단계 결과에 따라 구글 검색 툴을 동적으로 활성화합니다.
    const tools = needs_grounding ? [{ googleSearch: {} }] : [];

    const response = await generateContentWithRetry(ai, {
      model: modelName,
      contents,
      config: {
        temperature: 0.2,
        topP: 0.85,
        safetySettings,
        systemInstruction,
        thinkingConfig: { thinkingBudget: analysisProfile.thinkingBudget },
        ...(tools.length > 0 ? { tools } : {}),
      },
    }, {
      timeoutMs: 45000,  // 1차 Lite 호출에 걸린 시간을 제외한 약 45초의 넉넉한 타임아웃
      maxRetries: 0,     // 서버리스 강제 종료를 막기 위해 1차 실패 시 즉시 종료 (재시도 안 함)
      baseDelayMs: analysisProfile.baseDelayMs,
    });

    const text = response.text;
    const usageMetadata = response.usageMetadata || response.response?.usageMetadata;
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata || response.response?.candidates?.[0]?.groundingMetadata;
    const candidates = response.candidates || response.response?.candidates;

    return { text, usageMetadata, groundingMetadata, candidates };
  };

  try {
    let result: any = null;
    const modelsToTry = ["gemini-2.5-flash"];

    let lastError;
    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting analysis with model: ${modelName}`);
        result = await tryModel(modelName);
        if (result) break; // 단 1회 호출로 완료
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ Model ${modelName} failed: ${error?.message || error}`);

        // If quota is exhausted, don't try other models; they share the same quota.
        const status = Number(error?.status);
        const msg = String(error?.message || '');
        if (
          status === 429 ||
          msg.includes('429') ||
          msg.toLowerCase().includes('quota') ||
          msg.toLowerCase().includes('resource exhausted')
        ) {
          break;
        }

        // Small backoff before next model attempt on transient failures
        const isTransient =
          msg.includes('timeout') ||
          msg.includes('503') ||
          msg.toLowerCase().includes('overloaded');

        if (isTransient) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    }

    if (!result) {
      throw lastError || new Error("Gemini analysis failed to produce a result");
    }

    const text = result.text;
    console.log("Parsing AI response, text length:", text?.length ?? 'null');
    
    if (!text || text.trim().length === 0) {
      console.error("Empty text from result object. Candidates:", JSON.stringify(result.candidates?.map((c: any) => ({ finishReason: c.finishReason, contentParts: c.content?.parts?.length }))));
      throw new Error("Empty response from AI");
    }
    
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
      console.warn("JSON Parse Error (attempting repair):", (parseError as Error).message);
      
      // Repair attempt 1: Fix unescaped control characters inside string values
      let repaired = jsonString
        .replace(/[\x00-\x1F\x7F]/g, (ch: string) => {
          if (ch === '\n') return '\\n';
          if (ch === '\r') return '\\r';
          if (ch === '\t') return '\\t';
          return '';
        });
      
      try {
        analysisData = JSON.parse(repaired);
        console.log("JSON repair (control chars) succeeded");
      } catch {
        // Repair attempt 2: Extract field-by-field using regex
        console.warn("Control char repair failed, trying regex extraction");
        try {
          const getNum = (key: string) => {
            const m = repaired.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
            return m ? parseInt(m[1], 10) : null;
          };
          const getStr = (key: string) => {
            const m = repaired.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
            return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null;
          };
          // For long string fields, use a greedy approach between keys
          const getLongStr = (key: string, nextKey: string) => {
            const pattern = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"\\s*,\\s*"${nextKey}"`);
            const m = repaired.match(pattern);
            return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null;
          };

          analysisData = {
            accuracy: getNum('accuracy'),
            clickbait: getNum('clickbait'),
            reliability: getNum('reliability'),
            clickbaitTierLabel: getStr('clickbaitTierLabel'),
            thumbnail_spoiler: (() => {
              // 배열 형태 추출 시도
              const arrMatch = repaired.match(/"thumbnail_spoiler"\s*:\s*(\[[\s\S]*?\])\s*,/);
              if (arrMatch) {
                try { return JSON.parse(arrMatch[1]); } catch {}
              }
              // fallback: 구 string 형태
              const str = getLongStr('thumbnail_spoiler', 'subtitleSummary') || getStr('thumbnail_spoiler');
              const ts = getStr('thumbnail_spoiler_ts');
              return str ? [{ text: str, ts: ts || null }] : [];
            })(),
            subtitleSummary: getLongStr('subtitleSummary', 'evaluationReason') || getStr('subtitleSummary'),
            evaluationReason: getLongStr('evaluationReason', 'overallAssessment') || getStr('evaluationReason'),
            overallAssessment: getLongStr('overallAssessment', 'recommendedTitle') || getStr('overallAssessment'),
            recommendedTitle: getStr('recommendedTitle'),
          };

          if (analysisData.accuracy === null || analysisData.clickbait === null) {
            throw new Error("Regex extraction failed: missing required numeric fields");
          }
          console.log("JSON repair (regex extraction) succeeded");
        } catch (regexError) {
          console.error("All JSON repair attempts failed");
          console.error("Raw Text (first 500 chars):", text?.substring(0, 500));
          console.error("Extracted jsonString (first 500 chars):", jsonString?.substring(0, 500));
          throw new Error("Failed to parse AI response");
        }
      }
    }

    // grounding 사용 여부 감지
    const groundingMetadata = result.groundingMetadata;
    const groundingQueries: string[] = groundingMetadata?.webSearchQueries ?? [];
    const groundingUsed = groundingQueries.length > 0;
    console.log(`[grounding] used=${groundingUsed}, queries=${JSON.stringify(groundingQueries)}`);

    // [Post-processing] evaluationReason에 3번(신뢰도 총평)이 누락된 경우 자동 보완
    if (analysisData.evaluationReason && typeof analysisData.evaluationReason === 'string') {
      const hasSection3 = /3\.\s*신뢰도\s*총평/.test(analysisData.evaluationReason);
      if (!hasSection3 && analysisData.reliability != null) {
        const rel = Number(analysisData.reliability);
        const emoji = rel >= 70 ? '🟢' : rel >= 40 ? '🟡' : '🔴';
        const colorLabel = rel >= 70 ? 'Green' : rel >= 40 ? 'Yellow' : 'Red';
        const section3 = `<br /><br />3. 신뢰도 총평 (${rel}점 / ${emoji} ${colorLabel}):<br />종합 신뢰도 ${rel}점으로 ${colorLabel} 등급입니다.`;
        analysisData.evaluationReason = analysisData.evaluationReason.trimEnd() + section3;
        console.log('[Post-processing] evaluationReason에 누락된 3번(신뢰도 총평) 자동 보완');
      }

      // [Post-processing] 환각(Hallucination) 강제 교정: 검색 안 했는데 검색했다고 뻥치는 경우 서버단에서 강제 치환
      if (!groundingUsed && analysisData.evaluationReason.includes('구글 검색')) {
        console.warn('🚨 [Post-processing] grounding 미사용 상태에서 "구글 검색" 단어 감지됨. 서버단에서 강제 치환합니다.');
        analysisData.evaluationReason = analysisData.evaluationReason.replace(/[0-9]{4}년 상반기 구글 검색 결과와 일치하며,?/g, '자체 학습 데이터와 일치하며,');
        analysisData.evaluationReason = analysisData.evaluationReason.replace(/구글 검색( 결과)?/g, '자체 데이터');
      }
    }

    // [Final Safety Check] 삭제
    // standardizeTopic 호출 및 관련 로직 제거
    // -----------------------------------

    return { ...analysisData, groundingUsed, groundingQueries, usageMetadata: result.usageMetadata };

  } catch (error: any) {
    console.error("Gemini Analysis Error Full Details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw error;
  }
}
