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

  // 1. 자막 해상도 대폭 강화 (자막 원본 직투입 + 자연스러운 15초 단위 타임스탬프 부여)
  let quickSummary = '';
  let videoDurationStr = '알 수 없음';
  if (transcriptItems && transcriptItems.length > 0) {
    const lastItem = transcriptItems[transcriptItems.length - 1];
    const finalSeconds = lastItem.start + lastItem.duration;
    const finalMin = Math.floor(finalSeconds / 60);
    const finalSec = Math.floor(finalSeconds % 60);
    videoDurationStr = `${finalMin}분 ${finalSec}초`;

    let lastStamp = -999;
    for (const item of transcriptItems) {
      if (item.start - lastStamp >= 15) { // 15초 이상 차이날 때만 타임스탬프 찍기 (기계적인 1분 단위 탈피)
        const minute = Math.floor(item.start / 60);
        const minStr = String(minute).padStart(2, '0');
        const secStr = String(Math.floor(item.start % 60)).padStart(2, '0');
        quickSummary += `\n[${minStr}:${secStr}] `;
        lastStamp = item.start;
      }
      quickSummary += item.text + ' ';
      // 32분짜리 긴 영상도 다 들어갈 수 있도록 제한 대폭 증가 (gpt-4o-mini는 128k 컨텍스트 지원)
      if (quickSummary.length > 80000) break;
    }
    quickSummary = quickSummary.trim();
  } else {
    quickSummary = transcript ? transcript.substring(0, 80000) : '';
  }

  const thumbnailDataUrl = await thumbnailUrlToDataUrl(thumbnailUrl);

// ============================================================================
// 🚨 [WARNING: DO NOT TOUCH THIS PROMPT] 🚨
// ⚠️ 영구 동결 구역 (Freeze Zone) ⚠️
// 
// 1. 이 프롬프트와 fewShotExample은 수십 번의 테스트 끝에 gpt-4o-mini의 
//    '환각(Hallucination)', '포맷 파괴', '게으른 요약'을 완벽하게 통제하도록 
//    정밀하게 깎인(Tuned) 최종 버전입니다.
// 2. 새로운 AI(Windsurf, Cursor 등) 세션이 코드 최적화나 리팩토링을 명목으로 
//    단어, 띄어쓰기, 줄바꿈, 예시 문구를 절대! 네버! 수정하지 못하게 하십시오.
// 3. 부정 지시어(Negative prompt)를 추가하거나 템플릿 구조를 변경하면 
//    AI가 다시 바보가 되어 "📌 떡밥", "JSON 파괴" 등 대참사가 발생합니다.
// 4. 이 주석을 무시하고 프롬프트를 수정할 경우 전체 시스템 롤백을 각오해야 합니다.
// ============================================================================
  const fewShotExample = userLanguage === 'korean'
    ? `[가상의 낚시 영상 분석 예시]
🚨경고: 아래 예시의 타임스탬프(04:15 등)와 내용을 절대 그대로 베끼지 마라! 반드시 '실제 자막'의 진짜 시간과 흐름에 맞춰 작성하라.
{
  "subtitleSummary": "00:00 - 은퇴 후 투자 실패의 뼈아픈 교훈\\n노후 자금으로 고정 수익을 노리고 상가 분양에 뛰어든 사람들의 실패 사례를 소개합니다. 안정적으로 보였던 월세 수입이 어떻게 큰 손실로 이어지는지 구체적인 데이터를 통해 분석합니다.\\n\\n04:15 - 상가 투자의 숨겨진 함정과 위험성\\n신도시 상가의 높은 공실률과 대출 이자 부담으로 인한 파산 위험을 경고합니다. 특히 분양 대행사의 과장 광고에 속아 노후 자금을 모두 잃게 되는 과정을 상세히 설명합니다.",
  "thumbnail_spoiler": [
    {
      "topic": "최악의 투자 1위: 신도시 상가 분양",
      "text": "[출처: 유튜버의 주장] 영상에서 꼽은 최악의 투자는 '신도시 상가 분양'으로 지목함.",
      "ts": "04:15"
    }
  ]
}`
    : `[Fictional Clickbait Video Analysis Example]
🚨WARNING: DO NOT copy the timestamps (e.g., 04:15) or the exact content from this example. You MUST extract real timestamps and logical flow from the actual provided subtitles.
{
  "subtitleSummary": "00:00 - Painful Lessons of Retirement Investment Failures\\nIntroduces failure cases of people who invested in commercial real estate aiming for fixed income. Analyzes through specific data how seemingly stable monthly rent income leads to massive losses.\\n\\n04:15 - Hidden Traps and Risks of Commercial Real Estate\\nWarns of bankruptcy risks due to high vacancy rates and loan interest burdens in new city commercial areas. Details the process of losing retirement funds due to exaggerated advertising.",
  "thumbnail_spoiler": [
    {
      "topic": "#1 Worst Investment: New City Commercial Real Estate",
      "text": "[Source: YouTuber's Claim] The video specifically identifies 'new city commercial real estate' as the worst investment.",
      "ts": "04:15"
    }
  ]
}`;

  const prompt = `
## 1. Role
너는 시청자의 시간을 아껴주는 무자비한 '유튜브 스포일러 머신'이자 '유튜브 생태계 분석가'다.
영상의 서론이나 잡담은 무시하고, 제목과 썸네일에서 던진 '미끼(궁금증)'에 대한 '정확한 명사형 정답(종목명, 인물명, 장소 등)'을 핀셋처럼 추출하라.

## 2. Analysis Instructions
- **자막 전수 분석**: 입력된 자막 데이터의 처음부터 끝까지 단 한 줄도 빠짐없이 읽고 분석하라.
- **끝까지 요약 (매우 중요)**: 제공된 영상 자막의 전체 길이는 약 **${videoDurationStr}** 이다. 영상 중간(예: 8분, 10분대)에서 요약을 멈추는 행위는 치명적인 오류다. 반드시 영상 끝(${videoDurationStr})부분의 내용까지 빠짐없이 촘촘하게 요약하라. (주의: 타임스탬프는 반드시 해당 내용이 '시작되는 시간'을 적어야 하며, 영상이 끝나는 종료 시간을 적지 마라)
- **중간 생략 금지**: 영상 중간에서 요약을 멈추지 마라. 기계적으로 시간을 등분(예: 5분 간격)하지 말고, 반드시 실제 대화의 문맥과 화제가 전환되는 시점을 기준으로 챕터를 나누어 끝까지 요약하라.
- **팩트 추출**: '어떤 종목', '특정 인물'처럼 모호하게 얼버무리지 마라. 영상에 등장한 [실제 종목명/인물명/구체적 행동]을 반드시 명시하라.
- **챕터 개수 유동성 (매우 중요)**: 예시 데이터가 3개의 챕터라고 해서 무조건 3개로 고정하여 쪼개지 마라! 영상의 길이가 길고 내용이 방대하다면 5개, 10개, 15개 등 내용의 흐름이 전환될 때마다 필요한 만큼 충분히 많은 챕터로 분할하라.
- **요약의 기준**: 기계적인 2분/4분/6분 단위 쪼개기를 엄격히 금지한다. 영상의 '논리적 흐름(도입 → 문제 제기 → 해결책 → 결론)'이 바뀔 때마다 타임스탬프를 분할하라.
- **타임라인 요약 규칙 (매우 중요)**: 소제목 아래에 들어가는 요약 내용은 절대 단어나 한 줄(단답형)로 요약하지 마라. 반드시 해당 구간에서 유튜버가 무슨 논리로 설명했는지 구체적인 맥락을 포함하여 '2~3문장 분량으로 상세하고 풍성하게' 작성하라.

## 3. Thumbnail Spoiler Rules
- 'topic' 작성 규칙: 건조한 명사구(예: "외국인 자금 이동")로 적지 마라. 시청자에게 질문을 던지는 것이 아니라, 시청자가 제목과 썸네일(어그로)을 보고 **마음속으로 떠올릴 법한 본능적인 궁금증(질문)**을 그대로 적어라. (예: "그래서 외국인이 향하는 '여기'가 대체 어딘데?", "이번 주 터진다는 무시무시한 일이 뭐지?")
- 'text' 작성 규칙: 질문형 topic에 대한 해답(배경 설명)을 2~3문장 분량의 설명글로 자연스럽게 녹여내고, 마지막에 반드시 "[스포] XXX" 형식으로 질문에 대한 '진짜 정답(핵심 이유, 종목명, 결론 등)'을 돌직구로 밝혀라. (어그로 문구를 앵무새처럼 그대로 반복하지 마라)
- 정답 핀셋 추출 규칙 (매우 중요): 스포일러의 'text' 부분에 정답을 적을 때, 절대 '2차전지 관련주', '철강 종목'처럼 카테고리나 대분류로 뭉뚱그려 요약하지 마라. 영상에 등장한 '정확한 개별 종목명(예: LG엔솔, 삼성 SDI, 에코프로 등)'이나 '구체적인 고유 명사'를 무조건 텍스트에 꽂아 넣어라.
- 개수 제한 (매우 중요): 썸네일 스포일러는 영상의 전체 목차를 나열하는 곳이 절대 아니다. 타임라인(챕터) 개수와 무관하게, 오직 제목/썸네일의 어그로(미끼)에 대한 핵심 정답만 1~2개(최대 3개)로 압축해서 생성하라. 모든 챕터마다 기계적으로 스포일러를 만들면 심각한 오류다.
- 모든 떡밥 회수 (매우 중요): 제목과 썸네일에 서로 다른 궁금증(어그로)이 2개 이상 던져졌다면(예: ~한 이유? + 내일은 하락 베팅?), 절대 하나만 적고 넘어가지 말고 각각 독립된 스포일러 항목(topic)으로 분리해서 빠짐없이 떡밥을 회수하라.
- 어떤 경우든 thumbnail_spoiler를 빈 배열로 두지 마라. 반드시 1개 이상의 항목을 채워라.
- 각 항목의 ts(타임스탬프)는 "MM:SS" 형식. 자막에 타임스탬프가 없으면 ts를 null로.
- 시간순(ts 오름차순)으로 정렬하라.

## 4. 🌟 OUTPUT FORMAT & EXAMPLE (CRITICAL) 🌟
반드시 아래의 JSON 구조와 완벽하게 동일한 형식, 어조, 디테일 수준으로 작성하라.
절대 이 JSON 구조를 벗어나거나 불필요한 설명 텍스트를 덧붙이지 마라.
모든 텍스트 필드(subtitleSummary, thumbnail_spoiler 등)는 반드시 ${userLanguage === 'korean' ? '한국어' : 'English'}로 작성하라.

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
