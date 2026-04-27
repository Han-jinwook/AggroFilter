import OpenAI from 'openai';

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

    ## ⚠️ 썸네일 스포일러 (Thumbnail Spoiler) — 필수 필드 (MANDATORY, 절대 생략 금지)
    thumbnail_spoiler 필드는 **반드시** JSON에 포함해야 한다. 누락 시 불합격 응답이다.

    ### 핵심 원칙
    시청자는 제목/썸네일의 **특정 키워드나 문장에 꽂혀서** 10~20분짜리 영상을 보러 들어온다.
    제목과 썸네일이 던지는 떡밥(주장/궁금증)을 **소주제별로 분해**하고, 각 소주제에 대한 영상 속 팩트를 핀셋 추출하라.

    ### 작성 절차
    1. **떡밥 분해**: 제목+썸네일에서 시청자가 궁금해할 소주제(키워드/문장)를 1~4개로 분리하라.
       - 예: 제목 "日 후쿠시마 오염수 방류 개시…한국 수산물 안전한가?" → 소주제 ①"오염수 방류 현황" ②"한국 수산물 안전성"
       - 예: 제목 "연봉 1억 AI 엔지니어의 하루 루틴" → 소주제 ①"연봉/경력 배경" ②"하루 루틴"
    2. **팩트 매칭**: 각 소주제에 대해 자막에서 **정확한 팩트(대답)** 부분을 인용하라.
    3. **타임스탬프**: 팩트가 등장하는 자막 시점을 "MM:SS" 형식으로 기록하라.

    ### 작성 규칙
    - 장황한 요약이나 너의 주관적 논평은 절대 섞지 마라. 영상 속 발화자의 원문에 가깝게 인용하라.
    - 만약 어그로 낚시라서 해당 소주제의 정확한 팩트가 없다면, "[출처: 확인 불가] 정확히 일치하는 팩트 언급은 없으나, ~라는 언급이 가장 유사함"이라고 건조하게 팩트폭행하라.
    - 어떤 경우든 thumbnail_spoiler를 빈 배열로 두지 마라. 반드시 1개 이상의 항목을 채워라.
    - 각 항목의 ts(타임스탬프)는 "MM:SS" 형식. 자막에 타임스탬프가 없으면 ts를 null로.
    - 시간순(ts 오름차순)으로 정렬하라.

    ### 출처 명시 규칙
    각 항목의 text 필드 맨 앞에 반드시 [출처: ...] 태그를 명시하라.
    - 예시 1 (유튜버 생각): [출처: 유튜버의 개인 주장] 미국이 전쟁으로 노리는 진짜 돈줄은...
    - 예시 2 (뉴스 인용): [출처: 공식 언론 보도 인용] 구글이 공식 블로그를 통해...
    - 예시 3 (전문가 인용): [출처: 전문가 인터뷰 인용] 김OO 교수에 따르면...
    - 예시 4 (낚시): [출처: 확인 불가] 정확히 일치하는 팩트 언급은 없으나...
    출처 태그 없이 내용만 쓰는 것은 금지.

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

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    top_p: 0.85,
    messages: [
      {
        role: 'system',
        content: 'You are a precise JSON-only assistant.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

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
