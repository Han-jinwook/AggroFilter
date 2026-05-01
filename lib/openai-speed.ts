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

  // Few-shot 예시 블록: 언어에 따라 통째로 교체
  const fewShotExample = userLanguage === 'korean'
    ? `[가상의 낚시 영상 분석 예시]
- 제목: "은퇴 후 노후 자금 다 날리는 최악의 투자 1위... 2가지 대안은?"
- 자막: ... (생략) ...

{
  "subtitleSummary": "00:00 - [도입] 은퇴 후 투자 실패 사례 소개\\n02:30 - [원인] 고정 수익의 함정과 투자 위험성\\n06:15 - [결론] 노후를 망치는 최악의 투자 1위\\n10:20 - [대안] 안전한 대안 투자법 2가지 공개",
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
}`
    : `[Fictional Clickbait Video Analysis Example]
- Title: "The #1 Worst Investment That Ruins Your Retirement... 2 Alternatives?"
- Transcript: ... (omitted) ...

{
  "subtitleSummary": "00:00 - [Intro] Introduction to retirement investment failure cases\\n02:30 - [Cause] The trap of fixed-income investing\\n06:15 - [Conclusion] The #1 worst investment for retirees\\n10:20 - [Alternatives] Two safe alternatives revealed",
  "thumbnail_spoiler": [
    {
      "topic": "#1 Worst Investment",
      "text": "[Source: YouTuber's Opinion] The video warns against fixed-income investment traps that retirees commonly fall for. The #1 worst investment identified is 'new city commercial real estate', explicitly called out due to high vacancy rates.",
      "ts": "06:15"
    },
    {
      "topic": "2 Safe Alternatives",
      "text": "[Source: YouTuber's Opinion] Instead of commercial real estate, the video specifically names 'US Dividend Growth ETF (SCHD)' and 'Government Bonds' as concrete, safe alternatives for protecting retirement funds.",
      "ts": "10:20"
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
