// @/lib/gemini.ts

// This is a mock implementation of the analyzeContent function.
// TODO: Replace this with actual Gemini AI integration.

export async function analyzeContent(
  channelName: string,
  title: string,
  transcript: string,
  thumbnailUrl: string
) {
  console.log("[Mock AI] Analyzing content for:", title);

  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const mockResult = {
    topic: "테크놀로지",
    accuracy: 85,
    clickbait: 20,
    reliability: 75,
    subtitleSummary: "이 영상은 AI 기술의 최신 동향과 미래 전망에 대해 요약합니다.",
    evaluationReason: "내용이 사실에 기반하고 있으며, 출처가 명확합니다. 다만 일부 제목이 과장된 측면이 있습니다.",
    overallAssessment: "전반적으로 신뢰할 수 있는 정보이지만, 시청자의 주의가 일부 필요합니다.",
    recommendedTitle: "AI 기술의 현재와 미래, 심층 분석",
  };

  console.log("[Mock AI] Analysis complete.");
  return mockResult;
}
