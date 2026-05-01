import OpenAI from 'openai';

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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

async function thumbnailUrlToDataUrl(thumbnailUrl?: string): Promise<string | null> {
  if (!thumbnailUrl) return null;
  try {
    const candidates = getThumbnailFallbackUrls(thumbnailUrl);
    for (const candidate of candidates) {
      try {
        const response = await fetchWithTimeout(candidate, 1500);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

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
  userLanguage: 'korean' | 'english' = 'korean',
  thumbnailUrl?: string
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const client = new OpenAI({ apiKey });

  const chunks = transcriptItems && transcriptItems.length > 0
    ? coalesceChunks(chunkTranscriptItems(transcriptItems), 10)
    : [];

  const quickSummary = chunks.length > 0
    ? chunks.map((c) => `${c.startTime} - ${c.text}`).join('\n')
    : transcript.substring(0, 6000);

  const thumbnailDataUrl = await thumbnailUrlToDataUrl(thumbnailUrl);

  const prompt = `
    ## 2. 역할
    너는 엄격한 팩트체커가 아니라, **'유튜브 생태계 분석가'**다. 
    유튜브 특유의 표현 방식을 이해하되, 시청자가 실제로 **"속았다"**고 느끼는지 여부를 핵심 기준으로 점수를 매겨라.

    ## 분석 지침 (Critical Instructions)
    3. **타임스탬프 요약 가이드 (절대 규칙)**:
        - **자막 전수 분석**: 입력된 자막 데이터의 처음부터 끝까지 단 한 줄도 빠짐없이 읽고 분석하라.
        - **요약 개수 강제**: 영상의 핵심 흐름을 놓치지 않도록 **최소 3개에서 최대 8개** 사이의 챕터로 상세히 분할하라. (처음과 끝만 요약하는 것은 금지)
        - **종료 시점 일치**: 요약의 마지막 타임스탬프는 반드시 제공된 영상의 전체 길이(duration) 또는 자막의 마지막 시점과 일치해야 한다.
        - **형식**: '0:00 - 소주제: 요약내용' (특수문자/마크다운 금지).
        - **가변 분할**: 영상 길이에 따라 요약 개수를 조절하되, 전체 맥락이 촘촘히 연결되게 하라.

    ## ⚠️ 썸네일 스포일러 (Thumbnail Spoiler) — 황금비율 규칙 (V2)
    너의 임무는 영상 전체 요약이 아니다. 
    오직 **제목과 썸네일 이미지가 시청자에게 던진 '궁금증(떡밥)'에 대한 정답**만 스토리와 결론이 섞인 황금비율로 공개하라.

    ### 목적
    시청자가 클릭 전 가장 알고 싶어 하는 "그래서 제목/썸네일에서 낚은 그 결과가 무엇인가?"에 대해서만 핀셋 응답한다.

    ### 작성 범위 (엄격)
    - topic은 반드시 **제목/썸네일에서 직접 추출한 떡밥**만 사용.
    - 영상 본문에서 중요해 보여도, 제목/썸네일 떡밥이 아니면 **절대 포함 금지**.
    - 가치 판단(볼만한지, 신뢰도, 점수 평가) **절대 금지**.
    - 원인 분석/해석/의미 부여 **금지**. 정답(결론)만.

    ### 분량 및 구조 강제 (스토리 70% + 결론 30%)
    각 떡밥(topic)당 반드시 3~4문장(약 100~150자 내외)의 분량으로 작성해라.

    **도입부 1~2문장**: 유튜버가 해당 결론을 내기 위해 어떤 배경 설명이나 빌드업을 쳤는지 스토리라인과 맥락을 흥미롭게 요약한다.

    **결론부 1문장**: 앞의 맥락을 바탕으로, 결국 영상이 감추고 있던 최종 결론(명확한 팩트, 명사형 정답, 인물 등)을 돌직구로 던져서 마무리한다.

    ### 작성 절차
    1) 제목/썸네일에서 핵심 떡밥 1~4개 추출(topic).
    2) 각 떡밥에 대해 자막에서 해당 결론/언급 구간을 찾는다.
    3) text에는 3~4문장(도입부 1~2문장 + 결론부 1문장)으로 작성한다.

    ### text 필드 규칙
    - 반드시 '[출처: ...]' 태그로 시작.
    - 단순 중계체(~라고 말했습니다, ~라는 내용입니다)는 절대 금지한다.
    - 사건을 브리핑하듯 단호하고 무게감 있는 문체를 사용하되, 문장의 연결이 자연스러워야 한다.
    - 허용 예시:
      - '[출처: 유튜버의 개인 주장] 50대 이후 근육량이 감소하는 상황에서 무리한 하체 운동이 오히려 관절에 치명타를 입힐 수 있다고 경고함. 다양한 운동의 부작용을 설명한 끝에, 영상이 꼽은 절대 하면 안 되는 최악의 운동 1위는 결국 맨몸 스쿼트로 밝혀짐.'
      - '[출처: 전형적인 낚시] 트럼프 당선 직후 바이든 행정부 인사들의 대거 이탈 상황을 언급하며 엄청난 기밀 폭로가 있을 것처럼 분위기를 조성함. 그러나 영상이 끝날 때까지 썸네일에서 어그로를 끈 터널 끝의 빛(구체적 사건)의 실체는 단 한 번도 공개하지 않고 막연한 추측만 반복함.'
    - 금지 예시:
      - '유튜버가 ~라고 말했습니다', '~라는 내용입니다' 같은 중계체 문장
      - 배경 설명/평가/추론/교훈

    ### 품질 규칙
    - thumbnail_spoiler는 빈 배열 금지 (최소 1개).
    - 각 항목 text는 반드시 3~4문장(100~150자) 분량 유지.
    - 각 항목 ts는 "MM:SS", 시점 불명확하면 null.
    - 가능하면 시간순(ts 오름차순) 정렬.
    - 같은 떡밥의 중복 항목 금지.

    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 포함하지 말 것.
    **중요**: 모든 텍스트 필드는 반드시 **${userLanguage === 'korean' ? '한국어' : 'English'}**로 작성하라.

    {
      "subtitleSummary": "0:00 - 소주제: 요약내용\\n...",
      "thumbnail_spoiler": [
        { "topic": "소주제1 (제목/썸네일에서 추출한 떡밥 키워드)", "text": "[출처: ...] 해당 소주제에 대한 영상 속 팩트 인용", "ts": "02:15" },
        { "topic": "소주제2", "text": "[출처: ...] 팩트 인용 (외국어면 원문 뒤에 (한국어 번역) 추가)", "ts": "07:42" }
      ]
    }

    [분석 대상 데이터]
    채널명: ${channelName}
    제목: ${title}
    자막 내용:
    ${quickSummary}
  `;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let response;
  try {
    const userContent: any[] = [{ type: 'text', text: prompt }];
    if (thumbnailDataUrl) {
      userContent.push({
        type: 'image_url',
        image_url: { url: thumbnailDataUrl },
      });
    }

    response = await client.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        top_p: 0.85,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a precise JSON-only assistant. Always reply with a single valid JSON object only.',
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      },
      { signal: controller.signal }
    );
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? 'OpenAI speed track timeout (35s)' : (err?.message || 'OpenAI speed track failed');
    console.warn('[Speed Track][openai-speed] 호출 실패:', reason, { status: err?.status });
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const rawText = response.choices?.[0]?.message?.content || '';
  const raw = rawText.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  const jsonString = firstBrace !== -1 && lastBrace !== -1 ? raw.substring(firstBrace, lastBrace + 1) : raw;
  const parsed = JSON.parse(jsonString);

  return {
    subtitleSummary: typeof parsed?.subtitleSummary === 'string' ? parsed.subtitleSummary : '',
    thumbnail_spoiler: Array.isArray(parsed?.thumbnail_spoiler) ? parsed.thumbnail_spoiler : [],
  };
}
