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
너는 시청자의 시간을 아껴주는 무자비한 '유튜브 스포일러 머신'이자 '유튜브 생태계 분석가'다.
영상의 서론이나 잡담은 무시하고, 제목과 썸네일에서 던진 '미끼(궁금증)'에 대한 '정확한 명사형 정답(종목명, 인물명, 장소 등)'을 핀셋처럼 추출하라.

## 2. Analysis Instructions
- **자막 전수 분석**: 입력된 자막 데이터의 처음부터 끝까지 단 한 줄도 빠짐없이 읽고 분석하라.
- **종료 시점 일치**: 요약의 마지막 타임스탬프는 반드시 제공된 영상의 전체 길이 또는 자막의 마지막 시점과 일치해야 한다. (영상 중간이나 4분, 5분대에서 갑자기 요약을 끝내고 도망가는 행위는 매우 심각한 오류다. 영상이 30분짜리면 마지막 요약은 반드시 30분 근처여야 한다.)
- **중간 생략 금지**: 영상 중간에서 요약을 멈추지 마라. 전체 내용을 균등하게 배분하여 요약하라.
- **팩트 추출**: '어떤 종목', '특정 인물'처럼 모호하게 얼버무리지 마라. 영상에 등장한 [실제 종목명/인물명/구체적 행동]을 반드시 명시하라.
- **요약의 기준**: 기계적인 시간 단위 분할을 금지한다. 영상의 '논리적 흐름(도입 → 문제 제기 → 해결책 → 결론)'이 바뀔 때마다 타임스탬프를 분할하라.
- **타임라인 요약 규칙 (매우 중요)**: 소제목 아래에 들어가는 요약 내용은 절대 단어나 한 줄(단답형)로 요약하지 마라. 반드시 해당 구간에서 유튜버가 무슨 논리로 설명했는지 구체적인 맥락을 포함하여 '2~3문장 분량으로 상세하고 풍성하게' 작성하라.

## 3. Thumbnail Spoiler Rules
- 제목과 썸네일이 유도한 핵심 궁금증을 'topic'으로 잡는다.
- 'text' 필드에는 해당 결론이 나오게 된 배경을 짧게 요약하고, 마지막에 반드시 [진짜 정답]을 돌직구로 밝혀라.
- 정답 핀셋 추출 규칙 (매우 중요): 스포일러의 'text' 부분에 정답을 적을 때, 절대 '2차전지 관련주', '철강 종목'처럼 카테고리나 대분류로 뭉뚱그려 요약하지 마라. 영상에 등장한 '정확한 개별 종목명(예: LG엔솔, 삼성 SDI, 에코프로 등)'이나 '구체적인 고유 명사'를 무조건 텍스트에 꽂아 넣어라.
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
