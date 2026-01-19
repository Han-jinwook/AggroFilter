import OpenAI from 'openai';
import { pool } from '@/lib/db';
import { romanize } from '@/lib/hangul';

// OpenAI 클라이언트 초기화 (Singleton 패턴 권장되나 여기서는 함수 내에서 또는 모듈 레벨에서 생성)
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in environment variables");
  }
  return new OpenAI({ apiKey });
};

// Helper: Translate text to English (for embedding semantic consistency)
export async function translateText(text: string): Promise<string> {
  const openai = getOpenAIClient();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional translator. Translate the input text to English. Output ONLY the English text, nothing else." },
        { role: "user", content: text }
      ],
      temperature: 0,
    });
    return response.choices[0].message.content?.trim() || romanize(text);
  } catch (e) {
    console.error(`Translation failed for "${text}":`, e);
    return romanize(text);
  }
}

export async function analyzeContent(
  channelName: string,
  title: string,
  transcript: string,
  thumbnailUrl: string,
  duration?: string
) {
  const openai = getOpenAIClient();

  const systemPrompt = `
    # 어그로필터 분석 AI용 프롬프트 (유튜브 생태계 분석가 모드)
    
    ## 역할
    너는 엄격한 팩트체커가 아니라, **'유튜브 생태계 분석가'**다. 
    유튜브 특유의 표현 방식을 이해하되, 시청자가 실제로 **"속았다"**고 느끼는지 여부를 핵심 기준으로 점수를 매겨라.
    너는 특히 '맥락(Context)'을 파악하는 능력이 뛰어나다. 자극적인 단어를 썼더라도 그것이 영상의 핵심 내용을 잘 요약하거나 유튜브 문법상 허용되는 마케팅이라면 관대하게 평가하라.
    
    ## 분석 및 채점 기준 (Scoring Rubric)
    0점(Clean)에서 100점(Aggro) 사이로 어그로 점수를 매길 때, 아래 기준을 엄격히 따라라.
    
    1. 정확성 점수 (Accuracy Score) - **[선행 평가]**
    - 영상 본문 내용이 팩트에 얼마나 충실한지, 정보로서의 가치가 있는지 0~100점으로 먼저 평가하라.

    2. 어그로 지수 (Clickbait Score) - **[Fact-Based Gap Analysis]** 🎯
    - **핵심 원칙**: 어그로 점수는 단순한 '표현의 자극성'이 아니라, '제목/썸네일이 약속한 내용'과 '실제 영상 내용' 사이의 **불일치(Gap)** 정도를 기준으로 산정한다.

    - **상세 점수 기준 (The Gap Scale)**:
        - **0~20점 (일치/Marketing)**: [Gap 없음 - 피해 없음] 제목이 자극적이어도 내용이 이를 충분히 뒷받침함. (유튜브 문법상 허용되는 마케팅)
        - **21~40점 (과장/Exaggerated)**: [시간적 피해 (Time Loss)] 작은 사실을 침소봉대하여 시청자의 시간을 낭비하게 함. 핵심 팩트는 있으나 부풀려짐.
        - **41~60점 (왜곡/Distorted)**: [정신적 피해 (Mental Fatigue)] 문맥을 비틀거나 엉뚱한 결론을 내어 시청자에게 혼란과 짜증 유발. 정보 가치 낮음.
        - **61~100점 (허위/Fabricated)**: [실질적 피해 (Loss)] 없는 사실 날조, 사기성 정보. 심각한 오해나 실질적 손실 초래 가능.

    ### 최종 매핑 로직 (Accuracy Cap)
    정확도(Accuracy) 점수가 확보되지 않으면 어그로 점수는 낮아질 수 없다.
    - **🟢 Green (Clean)**: 정확도 70점 이상 → 어그로 점수 **0~30점** 강제 (내용이 좋으면 포장은 용서함)
    - **🟡 Yellow (Caution)**: 정확도 40~69점 → 어그로 점수 **0~60점** (과장 정도에 따라 유동적)
    - **🔴 Red (Warning)**: 정확도 0~39점 → 어그로 점수 **0~100점** (거짓말은 구제 불능)

    **[논리 일치성 절대 준수]**
    - "충격, 경악" 등의 단어를 썼더라도, 내용이 사실에 부합하면 0점에 가깝게 책정하라.
    - 점잖은 표현을 썼더라도, 내용이 거짓이면 100점에 가깝게 책정하라.
    - 텍스트 평가와 수치(점수)의 논리적 일관성을 반드시 유지하라.
    
    3. 신뢰도 및 상대적 평가 (Reliability & Relative Ranking)
    - **신뢰도 계산식**: (정확성 + (100 - 어그로 지수)) / 2
    - 이 영상이 해당 주제 내에서 상위 몇 % 수준의 신뢰도를 가질지 예측하여 총평에 반영하라.
    
    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 포함하지 말 것.
    
    {
      "accuracy": 0-100 (정수),
      "clickbait": 0-100 (정수),
      "reliability": 0-100 (정수),
      "subtitleSummary": "반드시 '0:00 - 요약내용' 형식의 타임스탬프를 포함하여 시간순 챕터별로 상세하게 요약하라. ${duration ? `영상의 총 길이는 ${duration}이다. 타임스탬프는 절대 이 길이를 초과할 수 없다.` : ''}",
      "evaluationReason": "점수 부여 근거(썸네일/제목 분석 포함) 및 숨은 의도 상세 서술. 총평(신호등 등급 포함) 필수.",
      "overallAssessment": "전반적인 평가 및 시청자 유의사항",
      "recommendedTitle": "어그로성 30% 이상일 때만 추천 제목 (아니면 빈 문자열)"
    }
    `;

  const userPrompt = `
    채널명: ${channelName}
    제목: ${title}
    자막 내용:
    ${transcript}
  `;

  try {
    console.log(`Attempting analysis with GPT-4o-mini (including thumbnail)...`);
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: {
              url: thumbnailUrl,
            },
          },
        ],
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const text = response.choices[0].message.content;
    if (!text) throw new Error("Empty response from OpenAI");

    const analysisData = JSON.parse(text);
    return analysisData;

  } catch (error: any) {
    console.error("GPT-4o-mini Analysis Error:", error);
    return {
      topic: "분석 실패",
      topic_en: "Analysis Failed",
      accuracy: 0,
      clickbait: 0,
      reliability: 0,
      subtitleSummary: `AI 분석 중 오류가 발생했습니다. (Error: ${error.message})`,
      evaluationReason: "일시적인 오류로 분석을 완료할 수 없습니다.",
      overallAssessment: "잠시 후 다시 시도해주세요.",
      recommendedTitle: title
    };
  }
}
