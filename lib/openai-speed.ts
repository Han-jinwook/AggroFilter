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

  const prompt = `
    ## 1. 역할
    너는 유튜브 생태계 분석가다. 시청자가 실제로 "속았다"고 느끼는지 여부를 핵심 기준으로 점수를 매겨라.

    ## 2. 분석 지침 (Critical Instructions)
    3. **타임스탬프 요약 가이드 (문맥 기반 자율 분할)**:
        - **기계적 분할 금지**: 5분, 10분 단위로 딱딱 끊지 마라. 자막의 흐름을 읽고 **주제가 실제로 바뀌는 시점**을 정확히 포착하라.
        - **유연한 개수**: 영상 길이에 따라 **2개에서 최대 8개** 사이로 자율적으로 나누되, 30분 이내 영상이라면 문맥에 따라 2~6개 정도가 적당하다.
        - **성의 있는 상세 요약**: 소제목 뒤에는 반드시 해당 구간의 핵심 내용을 **2~3문장**으로 상세히 요약하라. 유튜버의 논리 구조(근거->결론)가 보여야 한다.
        - **형식**: 'MM:SS - [소제목]\\n상세 요약 내용...'

    ## 3. ⚠️ 썸네일 스포일러 (Thumbnail Spoiler) — 구체적 팩트 폭격
    오직 **제목과 썸네일 이미지가 던진 '궁금증(떡밥)'**에 대해 영상에서 언급된 모든 내용을 종합하여 결론을 공개하라.

    ### 작성 규칙 (엄격)
    - **구체적 명사 필수**: '특정 주식', '어떤 인물' 등 모호한 표현은 절대 금지한다. **삼성전자, 한화오션, 홍길동** 등 영상에서 언급된 **실제 종목명이나 고유 명사 정답**을 반드시 포함하라.
    - **출처 표기**: 반드시 구체적인 출처 유형(예: [출처: 유튜버의 종목 추천], [출처: 기업 공시 인용])으로 시작하라.
    - **금지 사항**: '[출처: ...]' 처럼 점으로 표기하는 행위는 발견 시 즉시 탈락이다.

    ## 4. 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 모든 텍스트는 ${userLanguage === 'korean' ? '한국어' : 'English'}로 작성하라.

    {
      "subtitleSummary": "MM:SS - [문맥상 정확한 소제목]\\n상세 내용...",
      "thumbnail_spoiler": [
        { 
          "topic": "제목/썸네일 떡밥 키워드", 
          "text": "[출처: 유형] 실제 종목명/인물명 등 팩트가 포함된 결론 요약", 
          "ts": "MM:SS" 
        }
      ]
    }

    [분석 대상 데이터]
    채널명: ${channelName}
    제목: ${title}
    자막 데이터 (타임라인 참고용):
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
          { role: 'system', content: 'You are a precise JSON-only assistant. Never use placeholder dots in source tags.' },
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
