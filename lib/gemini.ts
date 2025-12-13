import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeContent(
  channelName: string,
  title: string,
  transcript: string,
  thumbnailUrl: string
) {
  // .env 파일의 GOOGLE_API_KEY를 우선적으로 사용
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  // Debug log (masked)
  console.log("Gemini API Key Loaded:", apiKey ? "Yes (Starts with " + apiKey.substring(0, 4) + ")" : "No");

  if (!apiKey) {
    console.error("API Key is not set");
    throw new Error("GOOGLE_API_KEY is not set in environment variables");
  }

  // Gemini API 클라이언트 초기화
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    console.log("Initializing Gemini model: gemini-2.5-flash");
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2, // 점수 산출의 정확성을 위해 낮게 설정 (프롬프트 가이드 준수)
        topP: 0.85,
      }
    });

    const systemPrompt = `
    # 어그로필터 분석 AI용 프롬프트 (유튜브 영상 전용)
    
    ## 역할
    너는 유튜브 영상의 제목, 썸네일, 본문 내용을 분석하여, 정확성, 어그로성, 신뢰도 점수를 산출하고, 평가 근거와 필요 시 착한 제목을 제안하는 분석 시스템이다. 분석 결과는 항상 콘텐츠의 원래 언어로 작성하며, 같은 콘텐츠는 언제나 일관된 결과가 나와야 한다.
    
    ## 분석 기준
    
    1. 주제 선정 기준
    - 콘텐츠 내용을 분석한 후, 한글 2단어 이내의 합성어로 최적 주제를 1개만 선정 (가칭 A)
    - 주제 마스터 리스트와 비교해 유사도 65% 이상인 경우, 해당 주제를 최우선 선정
    - 외국어 콘텐츠라도 한글 주제어로 반환
    
    2. 정확성 평가 기준
    - 제목과 본문 내용 일치도
    - 광고성 여부 판단 및 진실성
    - 감정적 프레임, 편향적 해석, 왜곡 여부
    - 출처 및 인용 데이터의 공신력
    - 정확성: 1~100점 (근거 필수 기재)
    
    3. 어그로성 평가 기준
    - 제목/썸네일이 광고성임을 숨기고 위장했는지 여부
    - 제목/썸네일과 본문 내용의 불일치도
    - 표현 수위, 자극성, 정보 전달 방식의 괴리
    - 감정적/자극적 키워드 사용 여부 (충격, 경악 등)
    - SNS형 과장 문구 사용 여부
    - 어그로성: 1~100% (근거 필수 기재)
    
    4. 신뢰도 점수 환산
    - 계산식: 신뢰도 = (정확성 + (100 - 어그로성)) ÷ 2
    - 신뢰도: 0~100점
    
    5. 평가이유 작성 기준
    - 정확성, 어그로성, 신뢰도 점수를 부여한 근거를 구체적으로 작성
    - 숨은 의도(상업적, 정치적, 여론조작 등)가 있다면 자연스럽게 포함해 설명
    - 친근하고 자연스러운 어투로 작성
    - **평가이유 총평에 신뢰도 점수에 따른 신호등 색상과 의미(안심, 주의, 경고)를 반드시 포함**
      - 신뢰도 70점 이상: 녹색불 (안심)
      - 신뢰도 50~69점: 노란불 (주의)
      - 신뢰도 50점 미만: 빨간불 (경고)
    
    6. 추천 제목 생성 기준
    - 어그로성이 30% 이상일 경우, 감정적/과장적 요소 제거 후 내용을 정확히 반영한 재미도 가미된 착하고 합리적인 제목 추천
    
    ## 입력 데이터
    - 채널명: ${channelName}
    - 제목: ${title}
    - 내용(자막): ${transcript.substring(0, 50000)} (길 경우 앞부분 사용)
    
    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 마크다운 포맷팅(\`\`\`json)을 포함하지 말 것.
    
    {
      "topic": "한글 주제 (2단어 이내)",
      "accuracy": 0-100 (정수),
      "clickbait": 0-100 (정수),
      "reliability": 0-100 (정수),
      "subtitleSummary": "시간순 챕터별 주요 내용 요약 (상세하게)",
      "evaluationReason": "점수 부여 근거 및 숨은 의도 상세 서술. 총평(신호등 등급 포함) 필수.",
      "overallAssessment": "전반적인 평가 및 시청자 유의사항",
      "recommendedTitle": "어그로성 30% 이상일 때만 추천 제목 (아니면 빈 문자열)"
    }
    `;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON 파싱 (혹시 모를 마크다운 제거)
    const jsonString = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim();
    
    try {
      const analysisData = JSON.parse(jsonString);
      return analysisData;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw Text:", text);
      throw new Error("Failed to parse AI response");
    }

  } catch (error) {
    console.error("Gemini Analysis Error Full Details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    // 에러 시 기본값 반환으로 서비스 중단 방지
    return {
      topic: "분석 실패",
      accuracy: 0,
      clickbait: 0,
      reliability: 0,
      subtitleSummary: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      evaluationReason: "일시적인 오류로 분석을 완료할 수 없습니다.",
      overallAssessment: "잠시 후 다시 시도해주세요.",
      recommendedTitle: title
    };
  }
}
