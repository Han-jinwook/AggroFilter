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
    ## 1. 역할 (핵심 미션)
    너는 영상 속에서 **'숨겨진 정답'**을 찾아내는 스나이퍼다. 
    시청자가 가장 궁금해하는 **실제 종목명, 인물명, 고유 명사**를 단 하나도 누락하지 말고 반드시 텍스트에 포함하라.

    ## 2. 분석 지침
    - **팩트 폭격 (필수)**: '어떤 종목', '관련 주식' 같은 모호한 표현을 쓰면 너의 분석은 실패다. **삼성전자, 에코프로, 엔비디아** 등 실제 이름을 반드시 써라.
    - **잡담 제거**: 인사, 농담, 구독 요청 등 본론 외의 모든 내용은 삭제하라. 0:00부터 바로 정보로 시작하라.

    3. **타임스탬프 요약**:
        - **문맥 분할**: 5분 단위가 아닌, 주제가 바뀌는 지점(2~6개)을 찾아라.
        - **형식**: 'MM:SS - [소제목]\\n상세 내용...'

    ## 3. ⚠️ 썸네일 스포일러 — 결론 핀셋 추출
    - **배경(1/3)**: 왜 이 결론이 나왔는지 맥락 설명.
    - **정답(2/3)**: 제목에서 낚은 궁금증에 대한 **진짜 정답(이름, 숫자)**을 돌직구로 공개.

    ## 4. 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 모든 텍스트는 ${userLanguage === 'korean' ? '한국어' : 'English'}로 작성하라.

    {
      "subtitleSummary": "MM:SS - [소제목]\\n상세 내용...",
      "thumbnail_spoiler": [
        { 
          "topic": "제목/썸네일에서 추출한 핵심 떡밥", 
          "text": "[출처: 유형] 스토리 빌드업(배경/맥락)을 먼저 기술한 후, 종목명/수치/결과 등 핵심 팩트로 강력하게 마무리하는 요약문", 
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
          { 
            role: 'system', 
            content: `You are a precise JSON-only assistant. 
              [Strict Rules]
              1. Never include intro/outro greetings, self-introductions, or subscriber requests. 
              2. Start directly with the main content at 0:00.
              3. Never include raw JSON symbols like {" or "} inside the text fields.
              4. In thumbnail_spoiler, you MUST identify the SPECIFIC answer to the bait (e.g., exact stock names, names of people). If the title says '2 stocks', you must name those 2 stocks.` 
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
