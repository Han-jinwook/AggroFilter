import fs from 'fs';

const content = `import OpenAI from 'openai';
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

  const chunks = transcriptItems && transcriptItems.length > 0
    ? coalesceChunks(chunkTranscriptItems(transcriptItems), 25)
    : [];

  const quickSummary = chunks.length > 0
    ? chunks.map((c) => c.startTime + " - " + c.text).join('\\n')
    : transcript.substring(0, 8000);

  const thumbnailDataUrl = await thumbnailUrlToDataUrl(thumbnailUrl);

  const prompt = "## 1. 역할\n" +
    "너는 유튜브 생태계 분석가다. 시청자가 실제로 \"속았다\"고 느끼는지 여부를 핵심 기준으로 점수를 매겨라.\n\n" +
    "## 2. 분석 지침 (Critical Instructions)\n" +
    "3. **타임스탬프 요약 가이드 (상세 요약 모드)**:\n" +
    "    - **자막 전수 분석**: 처음부터 끝까지 빠짐없이 분석하여 핵심 정보를 누락하지 마라.\n" +
    "    - **타임라인 정밀도**: 챕터 시작 시점은 문맥상의 실제 시점을 정확히 기록하라.\n" +
    "    - **성의 있는 상세 요약**: 단순히 한 줄 소제목으로 끝내지 마라. 각 챕터마다 [소제목]을 먼저 적고, 줄바꿈 후 해당 구간의 핵심 내용을 **2~3문장(3~4줄)** 정도로 상세히 요약하라.\n" +
    "    - **팩트 위주 요약**: 유튜버가 무엇을 근거로 어떤 결론을 내렸는지 논리 구조가 보이게 작성하라.\n" +
    "    - **요약 밀도**: 영상 10분당 약 2~3개의 챕터 분할을 유지하라.\n" +
    "    - **형식**: 'MM:SS - [소제목]\\n상세 요약 내용 1...\\n상세 요약 내용 2...'\n\n" +
    "## 3. ⚠️ 썸네일 스포일러 (Thumbnail Spoiler) — 황금비율 규칙 (V2)\n" +
    "오직 **제목과 썸네일 이미지가 던진 '궁금증(떡밥)'**을 1~3개 추출하고, 해당 떡밥에 대해 영상에서 언급된 모든 내용을 종합하여 결론을 공개하라.\n\n" +
    "### 작성 규칙 (엄격)\n" +
    "- **출처 표기 필수**: 반드시 구체적인 출처 유형으로 문장을 시작하라. (예: [출처: 유튜버의 개인 주장])\n" +
    "- **금지 사항**: '[출처: ...]' 처럼 점으로 표기하는 행위는 절대 금지한다.\n" +
    "- **구조**: 각 떡밥당 3~4문장 (도입부 2문장 + 최종 결론 1~2문장).\n\n" +
    "## 4. 출력 형식 (JSON Only)\n" +
    "반드시 아래 JSON 형식으로만 응답하라. 모든 텍스트는 " + (userLanguage === 'korean' ? '한국어' : 'English') + "로 작성하라.\n\n" +
    "{\n" +
    "  \"subtitleSummary\": \"0:00 - [챕터 제목]\\n이 구간에서 유튜버는 무엇에 대해 이야기합니다. 구체적으로 A라는 근거를 들어 B라는 결론을 도출합니다.\\n\\n0:45 - [다음 챕터]\\n...\",\n" +
    "  \"thumbnail_spoiler\": [\n" +
    "    { \n" +
    "      \"topic\": \"떡밥 키워드\", \n" +
    "      \"text\": \"[출처: 구체적유형 명시] 스토리라인과 최종 결론 요약\", \n" +
    "      \"ts\": \"MM:SS\" \n" +
    "    }\n" +
    "  ]\n" +
    "}\n\n" +
    "[분석 대상 데이터]\n" +
    "채널명: " + channelName + "\n" +
    "제목: " + title + "\n" +
    "자막 데이터 (타임라인 참고용):\n" +
    quickSummary + "\n";

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
          { role: 'system', content: 'You are a precise JSON-only assistant. Provide detailed 3-4 line summaries for each chapter.' },
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
`;

fs.writeFileSync('lib/openai-speed.ts', content, 'utf8');
`;

async function main() {
  fs.writeFileSync('scripts/fix_speed.mjs', content);
}

main();
