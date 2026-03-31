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
    retries: 1,
    baseDelayMs: 800,
    thinkingBudget: isShortForm ? 1024 : 2048,
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

  for (let i = 0; i < maxRetries; i++) {
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
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Below is a part of a YouTube video transcript.
Create a very short subtopic in Korean (1-4 words) that captures the main theme, then summarize the core content in exactly ONE concise Korean sentence.
Output format: 소주제  요약문장
Example: 주택 공급 확대  정부는 수도권 135만 채 공급 계획을 발표하고 있습니다.
Do NOT use brackets or labels. Output natural Korean text only.

Transcript:
${chunk.text}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = (result.text || '').trim();
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

    ## 시간 정보 및 지식 범위
    - **현재 날짜(분석 시점)**: ${today}
    - **영상 업로드일**: ${uploadDateStr || '알 수 없음'}
    - **너의 학습 데이터 종료 시점**: 2024년 10월
    - **⚠️ 절대 규칙**: 2024년 11월 이후의 정보는 너의 학습 데이터가 아닌 **Google Search 결과만을 신뢰**하라.
    
    제목에 연도가 포함된 경우, **영상 업로드 시점** 기준으로 과거/현재/미래를 판단하라. 업로드 당시 기준으로 현재이거나 과거인 연도는 '미래 시점'으로 간주하지 마라.
    
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
    
    ## 검색 도구 활용 가이드 (Google Search) — ⚠️ 최우선 규칙
    - **필수 검색 대상**: 인물의 현재 직책/직위, 최신 기술/제품, 2024년 11월 이후 사건·정책·논란
    - **검색 결과 절대 우선**: 검색 결과와 너의 학습 데이터(2024년 10월)가 충돌하면 **무조건 검색 결과를 따르라**.
    - **정확성 판단**: 영상의 주장과 검색 결과를 비교하여 일치하면 정확, 불일치하면 부정확으로 판단하라.
    - **사용 안 함**: 일반 상식, 오래된 역사, 유머/엔터테인먼트

    ### ⚠️ 필수 검색 트리거 (MANDATORY SEARCH — 위반 시 분석 무효)
    아래 키워드가 제목 또는 자막에 **하나라도** 포함되면 **반드시** Google Search를 실행한 후 사실 판단하라. 검색 없이 정확성 점수를 매기면 안 된다:
    - **선거/정치**: 선거, 경선, 투표, 대선, 총선, 보궐, 지방선거, 당선, 낙선, 출마, 사퇴, 탄핵, 임명, 해임, 국회, 여당, 야당, 민주당, 국민의힘, 대통령, 지사, 시장, 의원
    - **시사/사건**: 속보, 긴급, 논란, 수사, 체포, 구속, 판결, 기소, 제재, 전쟁, 외교
    - **시간 표현**: "현재", "최근", "오늘", "방금", "올해", 구체적 연도(2025, 2026 등)
    - **인물+행동**: 정치인/공인 이름 + 직책 변동이나 발언 언급

    ### 🚫 "없다/아니다" 주장 금지 규칙 (NEVER-WITHOUT-SEARCH)
    - **"X는 진행 중이 아니다", "X는 사실이 아니다", "X는 존재하지 않는다"**와 같은 부정 판단을 내리기 전에 **반드시 Google Search로 확인**하라.
    - 너의 학습 데이터에 없다고 해서 현실에서 일어나지 않는 것이 아니다. **검색 없이 "사실이 아니다"라고 단정하는 것은 최악의 오류다.**
    - 검색 결과에서도 확인되지 않을 때만 "확인되지 않음"이라고 서술하라.

    --- 

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
        - **종료 시점 일치**: 요약의 마지막 타임스탬프는 반드시 제공된 영상의 전체 길이(duration) 또는 자막의 마지막 시점과 일치해야 한다. (예: 2분 16초 영상이면 마지막 요약은 반드시 2:10~2:16 사이여야 함).
        - **중간 생략 금지**: 영상 중간에서 요약을 멈추는 행위는 심각한 오류로 간주한다. 전체 내용을 균등하게 배분하여 요약하라.
        - **형식**: '0:00 - 소주제: 요약내용' (특수문자/마크다운 금지).
        - **가변 분할**: 영상 길이에 따라 요약 개수를 조절하되, 영상 전체 맥락을 촘촘히 연결하라.
    
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
    
    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 포함하지 말 것.
    **중요**: 모든 텍스트 필드(evaluationReason, overallAssessment, recommendedTitle 등)는 반드시 **${userLanguage === 'korean' ? '한국어' : 'English'}**로 작성하라.
    
    {
      "is_valid_target": boolean, 
      "needs_admin_review": boolean, 
      "review_reason": "이유 (애매하거나 부적합한 경우)",
      "notAnalyzable": boolean, (기존 하위 호환용, is_valid_target과 연동)
      "accuracy": 0-100,
      "clickbait": 0-100,
      "reliability": 0-100,
      "clickbaitTierLabel": "일치/마케팅/훅|과장(오해/시간적 피해/낚임 수준)|왜곡(혼란/짜증)|허위/조작(실질 손실 가능)",
      "subtitleSummary": "0:00 - 소주제: 요약내용\\n...",
      "evaluationReason": "1. 내용 정확성 검증 (XX점):<br />내용...<br /><br />2. 어그로성 평가 (XX점):<br />내용...<br /><br />3. 신뢰도 총평 (XX점 / 🟢Green 또는 🟡Yellow 또는 🔴Red):<br />내용...",
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

    // Construct inputs: text prompt + thumbnail image (if available)
    // 긴 자막은 앞/중간/끝 균등 샘플링으로 타임아웃 방지
    const MAX_TRANSCRIPT_CHARS = 8000;
    const trimmedTranscript = (() => {
      if (!transcript || transcript.length <= MAX_TRANSCRIPT_CHARS) return transcript;
      const s1 = Math.floor(MAX_TRANSCRIPT_CHARS * 0.4); // 앞 40%
      const s2 = Math.floor(MAX_TRANSCRIPT_CHARS * 0.2); // 중간1 20%
      const s3 = Math.floor(MAX_TRANSCRIPT_CHARS * 0.2); // 중간2 20%
      const s4 = MAX_TRANSCRIPT_CHARS - s1 - s2 - s3;    // 끝 20%
      const len = transcript.length;
      const start = transcript.substring(0, s1);
      const mid1 = transcript.substring(Math.floor(len * 0.33), Math.floor(len * 0.33) + s2);
      const mid2 = transcript.substring(Math.floor(len * 0.66), Math.floor(len * 0.66) + s3);
      const end = transcript.substring(len - s4);
      return `${start}\n...(중략)...\n${mid1}\n...(중략)...\n${mid2}\n...(중략)...\n${end}`;
    })();

    const finalPrompt = `
      ${systemPrompt}
      
      [분석 대상 데이터]
      채널명: ${channelName}
      제목: ${title}
      자막 내용:
      ${trimmedTranscript}
    `;

    const contents: any[] = [finalPrompt];
    if (thumbnailPart) {
        contents.push(thumbnailPart);
    }
    
    const response = await generateContentWithRetry(ai, {
      model: modelName,
      contents,
      config: {
        temperature: 0.2,
        topP: 0.85,
        safetySettings,
        thinkingConfig: { thinkingBudget: analysisProfile.thinkingBudget },
        tools: [{ googleSearch: {} }],
      },
    }, {
      timeoutMs: analysisProfile.timeoutMs,
      maxRetries: analysisProfile.retries,
      baseDelayMs: analysisProfile.baseDelayMs,
    });
    
    // Validate response immediately to trigger fallback if blocked/empty
    const text = response.text;
    console.log("Raw AI Response:", text);
    if (!text) throw new Error("Empty response from AI (Likely Safety Block)");
    
    return response;
  };

  try {
    let result;
    // Strategy: Primary model + safe fallback
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

    if (!result && lastError) {
      throw lastError;
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
        .replace(/[\x00-\x1F\x7F]/g, (ch) => {
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

    if (subtitleSummaryOverride) {
      analysisData.subtitleSummary = subtitleSummaryOverride;
    }

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
    }

    // [Final Safety Check] 삭제
    // standardizeTopic 호출 및 관련 로직 제거
    // -----------------------------------

    // grounding 사용 여부 감지
    const groundingMetadata = result?.candidates?.[0]?.groundingMetadata
    const groundingQueries: string[] = groundingMetadata?.webSearchQueries ?? []
    const groundingUsed = groundingQueries.length > 0
    console.log(`[grounding] used=${groundingUsed}, queries=${JSON.stringify(groundingQueries)}`)

    // ⚠️ 정치/시사 키워드가 있는데 grounding 미사용 시 경고
    const POLITICAL_KEYWORDS = /선거|경선|투표|대선|총선|보궐|지방선거|당선|낙선|출마|사퇴|탄핵|임명|해임|국회|여당|야당|민주당|국민의힘|대통령|지사|시장|의원|속보|긴급|수사|체포|구속|판결|기소/
    const hasPoliticalKeyword = POLITICAL_KEYWORDS.test(title) || POLITICAL_KEYWORDS.test(transcript?.substring(0, 2000) || '')
    if (hasPoliticalKeyword && !groundingUsed) {
      console.error(`🚨 [GROUNDING MISS] 정치/시사 콘텐츠인데 Google Search 미사용! 제목: "${title}" — 분석 결과가 부정확할 수 있음`)
    }

    return { ...analysisData, groundingUsed, groundingQueries };

  } catch (error: any) {
    console.error("Gemini Analysis Error Full Details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw error;
  }
}
