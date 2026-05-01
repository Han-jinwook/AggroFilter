import OpenAI from 'openai';
import { formatSecondsToTimestamp } from './utils';

async function thumbnailUrlToDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    return "data:" + blob.type + ";base64," + buffer.toString('base64');
  } catch (err) {
    console.error('[openai-speed] Thumbnail fetch failed:', err);
    return null;
  }
}

function chunkTranscriptItems(items: { text: string; start: number; duration: number }[]) {
  const minChunkSeconds = 45;
  const maxChunkSeconds = 120;
  const chunks: { text: string; start: number }[] = [];
  
  let currentText = '';
  let currentStart = items[0]?.start || 0;
  
  for (const item of items) {
    currentText += item.text + ' ';
    if (item.start + item.duration - currentStart > maxChunkSeconds) {
      chunks.push({ text: currentText.trim(), start: currentStart });
      currentText = '';
      currentStart = item.start;
    }
  }
  if (currentText) {
    chunks.push({ text: currentText.trim(), start: currentStart });
  }
  return chunks;
}

function coalesceChunks(chunks: { text: string; start: number }[], maxChunks: number) {
  if (chunks.length <= maxChunks) {
    return chunks.map(c => ({ text: c.text, startTime: formatSecondsToTimestamp(c.start) }));
  }
  const factor = Math.ceil(chunks.length / maxChunks);
  const result = [];
  for (let i = 0; i < chunks.length; i += factor) {
    const slice = chunks.slice(i, i + factor);
    result.push({
      text: slice.map(s => s.text).join(' '),
      startTime: formatSecondsToTimestamp(slice[0].start)
    });
  }
  return result;
}

export async function analyzeContentSpeed(
  channelName: string,
  title: string,
  transcript: string,
  transcriptItems?: { text: string; start: number; duration: number }[],
  userLanguage: 'korean' | 'english' = 'korean',
  thumbnailUrl?: string
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const client = new OpenAI({ apiKey });

  // 1. 자막 해상도 대폭 강화 (30~60초 단위로 촘촘하게 전달)
  const chunks = transcriptItems && transcriptItems.length > 0
    ? coalesceChunks(chunkTranscriptItems(transcriptItems), 50) // 최대 50개까지 노출하여 정밀도 확보
    : [];

  const quickSummary = chunks.length > 0
    ? chunks.map((c) => `[${c.startTime}] ${c.text}`).join('\n')
    : transcript.substring(0, 10000); 

  const thumbnailDataUrl = await thumbnailUrlToDataUrl(thumbnailUrl);

  const fewShotExample = userLanguage === 'korean'
    ? `[가상의 낚시 영상 분석 예시]
🚨경고: 아래 예시의 타임스탬프(04:15 등)와 내용을 절대 그대로 베끼지 마라! 반드시 '실제 자막'의 진짜 시간과 흐름에 맞춰 작성하라.
{
  "subtitleSummary": "00:00 - 은퇴 후 투자 실패의 뼈아픈 교훈\\n노후 자금으로 고정 수익을 노리고 상가 분양에 뛰어든 사람들의 실패 사례를 소개합니다. 안정적으로 보였던 월세 수입이 어떻게 큰 손실로 이어지는지 구체적인 데이터를 통해 분석합니다.\\n\\n04:15 - 상가 투자의 숨겨진 함정과 위험성\\n신도시 상가의 높은 공실률과 대출 이자 부담으로 인한 파산 위험을 경고합니다. 특히 분양 대행사의 과장 광고에 속아 노후 자금을 모두 잃게 되는 과정을 상세히 설명합니다.\\n\\n09:30 - 노후 자금을 지키는 안전한 대안 투자법\\n위험한 상가 투자 대신 '미국 배당 성장 ETF(SCHD)'와 같은 안전한 대안을 제시합니다. 장기적인 관점에서 배당 수익과 자본 차익을 동시에 얻을 수 있는 전략을 강조합니다.",
  "thumbnail_spoiler": [
    {
      "topic": "최악의 투자 1위: 신도시 상가 분양",
      "text": "[출처: 유튜버의 주장] 영상에서 꼽은 최악의 투자는 '신도시 상가 분양'으로 지목함.",
      "ts": "04:15"
    },
    {
      "topic": "대안 투자법: SCHD ETF·국채",
      "text": "[출처: 유튜버의 주장] 상가 투자 대신 '미국 배당 성장 ETF(SCHD)'를 대안으로 제시함.",
      "ts": "09:30"
    }
  ]
}`
    : `[Fictional Clickbait Video Analysis Example]
🚨WARNING: DO NOT copy the timestamps (e.g., 04:15) or the exact content from this example. You MUST extract real timestamps and logical flow from the actual provided subtitles.
{
  "subtitleSummary": "00:00 - Painful Lessons of Retirement Investment Failures\\nIntroduces failure cases of people who invested in commercial real estate aiming for fixed income. Analyzes through specific data how seemingly stable monthly rent income leads to massive losses.\\n\\n04:15 - Hidden Traps and Risks of Commercial Real Estate\\nWarns of bankruptcy risks due to high vacancy rates and loan interest burdens in new city commercial areas. Details the process of losing retirement funds due to exaggerated advertising.\\n\\n09:30 - Safe Alternative Investments to Protect Retirement Funds\\nSuggests 'US Dividend Growth ETF (SCHD)' as a safe alternative to risky commercial real estate. Emphasizes strategies to gain dividend income from a long-term perspective.",
  "thumbnail_spoiler": [
    {
      "topic": "#1 Worst Investment: New City Commercial Real Estate",
      "text": "[Source: YouTuber's Claim] The video specifically identifies 'new city commercial real estate' as the worst investment.",
      "ts": "04:15"
    },
    {
      "topic": "Alternative Investments: SCHD ETF & Government Bonds",
      "text": "[Source: YouTuber's Claim] The video suggests 'US Dividend Growth ETF (SCHD)' as a safe alternative.",
      "ts": "09:30"
    }
  ]
}`;

  const prompt = `
## 1. Role
너는 시청자의 시간을 아껴주는 무자비한 '유튜브 스포일러 머신'이다.
영상의 서론이나 잡담은 무시하고, 제목과 썸네일에서 던진 '미끼(궁금증)'에 대한 '정확한 명사형 정답(종목명, 인물명, 장소 등)'을 핀셋처럼 추출하라.

## 2. Analysis Instructions
- 팩트 추출: '어떤 종목', '특정 인물'처럼 모호하게 얼버무리지 마라. 영상에 등장한 [실제 종목명/인물명/구체적 행동]을 반드시 명시하라.
- 요약의 기준: 기계적인 시간 단위 분할을 금지한다. 영상의 '논리적 흐름(도입 → 문제 제기 → 해결책 → 결론)'이 바뀔 때마다 타임스탬프를 분할하라.
- 타임라인 요약 규칙 (매우 중요): 소제목 아래에 들어가는 요약 내용은 절대 단어나 한 줄(단답형)로 요약하지 마라. 반드시 해당 구간에서 유튜버가 무슨 논리로 설명했는지 구체적인 맥락을 포함하여 '2~3문장 분량으로 상세하고 풍성하게' 작성하라.

## 3. Thumbnail Spoiler Rules
- 제목과 썸네일이 유도한 핵심 궁금증을 'topic'으로 잡는다.
- 'text' 필드에는 해당 결론이 나오게 된 배경을 짧게 요약하고, 마지막에 반드시 [진짜 정답]을 돌직구로 밝혀라.

## 4. 🌟 OUTPUT FORMAT & EXAMPLE (CRITICAL) 🌟
반드시 아래의 JSON 구조와 완벽하게 동일한 형식, 어조, 디테일 수준으로 작성하라.
절대 이 JSON 구조를 벗어나거나 불필요한 설명 텍스트를 덧붙이지 마라.

${fewShotExample}

[실제 분석 대상 데이터]
채널명: ${channelName}
제목: ${title}
자막 내용:
${quickSummary}
`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const userContent = [{ type: 'text', text: prompt }];
    if (thumbnailDataUrl) {
      userContent.push({
        type: 'image_url',
        image_url: { url: thumbnailDataUrl },
      });
    }

    const response = await client.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        top_p: 0.9,
        response_format: { type: 'json_object' },
        messages: [
          { 
            role: 'system', 
            content: `You are a YouTube spoiler machine that outputs only valid JSON. Follow the user's instructions and example format exactly.` 
          },
          { role: 'user', content: userContent },
        ],
      },
      { signal: controller.signal }
    );

    const rawText = response.choices[0].message.content || '';
    const parsed = JSON.parse(rawText);

    return {
      subtitleSummary: typeof parsed?.subtitleSummary === 'string' ? parsed.subtitleSummary : '',
      thumbnail_spoiler: Array.isArray(parsed?.thumbnail_spoiler) ? parsed.thumbnail_spoiler : [],
    };
  } catch (err) {
    console.warn('[Speed Track] 분석 실패:', err.message);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
