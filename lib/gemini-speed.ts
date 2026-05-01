import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';

function formatSecondsToTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function chunkTranscriptItems(
  items: { text: string; start: number; duration: number }[],
  options?: { minChunkSeconds?: number; maxChunkSeconds?: number }
): { startTime: string; text: string }[] {
  const minChunkSeconds = options?.minChunkSeconds ?? 90;
  const maxChunkSeconds = options?.maxChunkSeconds ?? 5 * 60;

  if (!items || items.length === 0) return [];

  const chunks: { startTime: string; text: string }[] = [];
  let currentStart = items[0].start;
  let currentEnd = items[0].start + items[0].duration;
  let currentTextParts: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const next = i + 1 < items.length ? items[i + 1] : null;

    currentTextParts.push(it.text);
    currentEnd = Math.max(currentEnd, it.start + it.duration);

    const chunkDuration = currentEnd - currentStart;
    const gapToNext = next ? next.start - (it.start + it.duration) : 0;

    const shouldSplitByGap = next ? gapToNext >= 2 : false;
    const shouldSplitByMax = chunkDuration >= maxChunkSeconds;
    const canSplitNow = chunkDuration >= minChunkSeconds;

    if (next && (shouldSplitByMax || (shouldSplitByGap && canSplitNow))) {
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

export async function analyzeContentSpeed(
  channelName: string,
  title: string,
  transcript: string,
  transcriptItems?: { text: string; start: number; duration: number }[],
  userLanguage: 'korean' | 'english' = 'korean'
) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not set in environment variables');
  }

  const ai = new GoogleGenAI({ apiKey });

  const chunks = transcriptItems && transcriptItems.length > 0
    ? coalesceChunks(chunkTranscriptItems(transcriptItems), 10)
    : [];

  const quickSummary = chunks.length > 0
    ? chunks.map((c) => `${c.startTime} - ${c.text}`).join('\n')
    : transcript.substring(0, 6000);

  const prompt = `
## 1. Role
너는 시청자의 시간을 아껴주는 무자비한 '유튜브 스포일러 머신'이다.
영상의 서론이나 잡담은 무시하고, 제목과 썸네일에서 던진 '미끼(궁금증)'에 대한 '정확한 명사형 정답(종목명, 인물명, 장소 등)'을 핀셋처럼 추출하라.

## 2. Analysis Instructions
- 팩트 추출: '어떤 종목', '특정 인물'처럼 모호하게 얼버무리지 마라. 영상에 등장한 [실제 종목명/인물명/구체적 행동]을 반드시 명시하라.
- 요약의 기준: 기계적인 시간 단위 분할을 금지한다. 영상의 '논리적 흐름(도입 → 문제 제기 → 해결책 → 결론)'이 바뀔 때마다 타임스탬프를 분할하라.

## 3. Thumbnail Spoiler Rules
- 제목과 썸네일이 유도한 핵심 궁금증을 'topic'으로 잡는다 — 반드시 실제 결론 키워드(종목명, 인물명, 사건명)로 작성하라.
- 'text' 필드에는 해당 결론이 나오게 된 배경을 짧게 요약하고, 마지막에 반드시 [진짜 정답]을 돌직구로 밝혀라.
- 각 항목 text 필드 맨 앞에 반드시 [출처: 유튜버의 개인 주장 / 공식 언론 보도 인용 / 전문가 인터뷰 인용 / 확인 불가] 중 하나를 명시하라.

## 4. 🌟 OUTPUT FORMAT & EXAMPLE (CRITICAL) 🌟
반드시 아래의 JSON 구조와 완벽하게 동일한 형식, 어조, 디테일 수준으로 작성하라.
절대 이 JSON 구조를 벗어나거나 불필요한 설명 텍스트를 덧붙이지 마라.
(경고: 이 예시를 그대로 복사하거나 구조를 임의로 변형하지 마십시오. 결과 데이터의 타임스탬프는 반드시 영상 내용과 일치해야 합니다.)

[가상의 낚시 영상 분석 예시]
- 제목: "은퇴 후 노후 자금 다 날리는 최악의 투자 1위... 2가지 대안은?"
{
  "subtitleSummary": "00:00 - 은퇴 후 상가 투자 실패 사례: 노후 자금 함정 경고\n03:12 - 고정 수익의 함정과 투자 위험성 분석\n08:45 - 신도시 상가 분양: 최악의 투자 1위로 명확히 지목\n11:30 - SCHD ETF·국채: 안전한 대안 2가지 실명 공개",
  "thumbnail_spoiler": [
    {
      "topic": "최악의 투자 1위",
      "text": "[출처: 유튜버의 개인 주장] 노후에 고정 수익을 노리고 접근하기 쉬운 투자법의 위험성을 경고함. 영상에서 꼽은 최악의 투자는 '신도시 상가 분양'으로, 높은 공실률 때문에 절대 피해야 한다고 명확히 지목함.",
      "ts": "06:15"
    },
    {
      "topic": "안전한 대안 투자법 2가지",
      "text": "[출처: 유튜버의 개인 주장] 상가 투자 대신 노후 자금을 지킬 수 있는 안전한 대안으로 '미국 배당 성장 ETF(SCHD)'와 '국채 매입'을 구체적인 정답으로 제시함.",
      "ts": "10:20"
    }
  ]
}

[실제 분석 대상 데이터]
채널명: ${channelName}
제목: ${title}
자막 내용:
${quickSummary}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [prompt],
    config: {
      temperature: 0.2,
      topP: 0.85,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    },
  });

  const raw = (response.text || '').replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  const jsonString = firstBrace !== -1 && lastBrace !== -1 ? raw.substring(firstBrace, lastBrace + 1) : raw;
  const parsed = JSON.parse(jsonString);

  return {
    subtitleSummary: typeof parsed?.subtitleSummary === 'string' ? parsed.subtitleSummary : '',
    thumbnail_spoiler: Array.isArray(parsed?.thumbnail_spoiler) ? parsed.thumbnail_spoiler : [],
  };
}
