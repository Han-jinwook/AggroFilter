import OpenAI from 'openai';

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

  // 1. 자막 해상도 대폭 강화 (자막 원본 직투입)
  // 스피드 트랙에서도 굳이 청크 분할 과정을 거칠 필요 없이, 온전한 자막 전체(최대 35,000자)를 1개 덩어리로 던집니다.
  const quickSummary = transcript ? transcript.substring(0, 35000) : '';

  const thumbnailDataUrl = await thumbnailUrlToDataUrl(thumbnailUrl);



  const prompt = `
## 1. Role
너는 시청자의 시간을 아껴주는 무자비한 '유튜브 스포일러 머신'이자 '유튜브 생태계 분석가'다.
영상의 서론이나 잡담은 무시하고, 제목과 썸네일에서 던진 '미끼(궁금증)'에 대한 '정확한 명사형 정답(종목명, 인물명, 장소 등)'을 핀셋처럼 추출하라.

## 2. Analysis Instructions - ⚠️ 절대 규칙 (CRITICAL RULES)
- **자막 전수 분석**: 입력된 자막 데이터의 처음부터 끝까지 단 한 줄도 빠짐없이 읽고 분석하라.
- **종료 시점 일치**: 요약의 마지막 타임스탬프는 반드시 제공된 영상의 전체 길이 또는 자막의 마지막 시점과 일치해야 한다. (영상 중간이나 4분, 5분대에서 갑자기 요약을 끝내고 도망가는 행위는 매우 심각한 오류다. 영상이 30분짜리면 마지막 요약은 반드시 30분 근처여야 한다.)
- **중간 생략 금지**: 영상 중간에서 요약을 멈추지 마라. 전체 내용을 균등하게 배분하여 요약하라.
- **팩트 추출**: '어떤 종목', '특정 인물'처럼 모호하게 얼버무리지 마라. 영상에 등장한 [실제 종목명/인물명/구체적 행동]을 반드시 명시하라.
- **요약의 기준**: 기계적인 시간 단위 분할을 금지한다. 영상의 '논리적 흐름(도입 → 문제 제기 → 해결책 → 결론)'이 바뀔 때마다 타임스탬프를 분할하라.
- **타임라인 요약 규칙**: 소제목 아래에 들어가는 요약 내용은 절대 단어나 한 줄(단답형)로 요약하지 마라. 반드시 해당 구간에서 유튜버가 무슨 논리로 설명했는지 구체적인 맥락을 포함하여 '2~3문장 분량으로 상세하고 풍성하게' 작성하라.

## 3. Thumbnail Spoiler Rules
- 제목과 썸네일이 유도한 핵심 궁금증을 'topic'으로 잡는다.
- 'text' 필드에는 해당 결론이 나오게 된 배경을 짧게 요약하고, 마지막에 반드시 [진짜 정답]을 돌직구로 밝혀라.
- 정답 핀셋 추출 규칙 (매우 중요): 스포일러의 'text' 부분에 정답을 적을 때, 절대 '2차전지 관련주', '철강 종목'처럼 카테고리나 대분류로 뭉뚱그려 요약하지 마라. 영상에 등장한 '정확한 개별 종목명(예: LG엔솔, 삼성 SDI, 에코프로 등)'이나 '구체적인 고유 명사'를 무조건 텍스트에 꽂아 넣어라.
- 어떤 경우든 thumbnail_spoiler를 빈 배열로 두지 마라. 반드시 1개 이상의 항목을 채워라.
- 각 항목의 ts(타임스탬프)는 "MM:SS" 형식. 자막에 타임스탬프가 없으면 ts를 null로.
- 시간순(ts 오름차순)으로 정렬하라.

## 4. 출력 형식 (JSON Only)
반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 포함하지 말 것.
**중요**: 모든 텍스트 필드(subtitleSummary, thumbnail_spoiler 등)는 반드시 ${userLanguage === 'korean' ? '한국어' : 'English'}로 작성하라.

{
  "subtitleSummary": "0:00 - 소주제: 요약내용\\n...",
  "thumbnail_spoiler": [
    { "topic": "소주제1 (제목/썸네일에서 추출한 떡밥 키워드)", "text": "[출처: ...] 해당 소주제에 대한 영상 속 팩트 인용", "ts": "02:15" },
    { "topic": "소주제2", "text": "[출처: ...] 팩트 인용", "ts": "07:42" }
  ]
}

[실제 분석 대상 데이터]
채널명: ${channelName}
제목: ${title}
자막 내용:
${quickSummary}
`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const userContent: any[] = [{ type: 'text', text: prompt }];
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
      usage: response.usage
    };
  } catch (err) {
    console.warn('[Speed Track] 분석 실패:', (err as any).message);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
