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
        - **종료 시점 일치**: 요약의 마지막 타임스탬프는 반드시 제공된 영상의 전체 길이(duration) 또는 자막의 마지막 시점과 일치해야 한다. (예: 2분 16초 영상이면 마지막 요약은 반드시 2:10~2:16 사이여야 함).
        - **중간 생략 금지**: 영상 중간에서 요약을 멈추는 행위는 심각한 오류로 간주한다. 전체 내용을 균등하게 배분하여 요약하라.
        - **형식**: '0:00 - 소주제: 요약내용' (특수문자/마크다운 금지).
        - **가변 분할**: 영상 길이에 따라 요약 개수를 조절하되, 영상 전체 맥락을 촘촘히 연결하라.

    ## ⚠️ 썸네일 스포일러 (Thumbnail Spoiler) — 절대 규칙
    너의 임무는 영상 전체 요약이 아니다.
    **제목/썸네일이 던진 떡밥의 정답만** 빠르게 공개하라.

    ### 목적
    시청자가 궁금한 것은 "그래서 제목/썸네일에서 낚은 그 떡밥의 결론이 뭐냐"이다.
    따라서 thumbnail_spoiler는 오직 그 질문에만 답해야 한다.

    ### 작성 범위 (엄격)
    - topic은 반드시 **제목/썸네일에서 직접 추출한 떡밥**만 사용.
    - 영상 본문에서 중요해 보여도, 제목/썸네일 떡밥이 아니면 **절대 포함 금지**.
    - 가치 판단(볼만한지, 신뢰도, 점수 평가) **절대 금지**.
    - 원인 분석/해석/의미 부여 **금지**. 정답(결론)만.

    ### 작성 절차
    1) 제목/썸네일에서 핵심 떡밥 1~4개 추출(topic).
    2) 각 떡밥에 대해 자막에서 해당 결론/언급 구간을 찾는다.
    3) text에는 결론만 단답형으로 작성한다. (장황한 중계 금지)

    ### text 필드 규칙
    - 반드시 '[출처: ...]' 태그로 시작.
    - 허용 예시:
      - '[출처: 유튜버의 개인 주장] 'OOO'를 몸통으로 지목함.'
      - '[출처: 뉴스 보도 인용] 조지아주 가금류 매매 금지 조치 언급.'
      - '[출처: 전형적인 낚시] 제목의 핵심 떡밥(OOO) 실체는 끝까지 공개하지 않음.'
    - 금지 예시:
      - '유튜버가 ~라고 말했습니다', '~라는 내용입니다' 같은 중계체 문장
      - 배경 설명/평가/추론/교훈

    ### 품질 규칙
    - thumbnail_spoiler는 빈 배열 금지 (최소 1개).
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
