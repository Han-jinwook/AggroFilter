import OpenAI from 'openai';

// 1. 확실한 정보성 카테고리: 1단계 API 호출 없이 0초 만에 즉시 통과 (비용 0원, 지연 0초)
export const SAFE_PASS_CATEGORIES = new Set([
  '25', // News & Politics (뉴스/정치)
  '27', // Education (교육)
  '28', // Science & Technology (과학/기술)
  '26', // Howto & Style (노하우/스타일)
  '22', // People & Blogs (인물/블로그)
  '29', // Nonprofits & Activism (비영리/사회운동)
  '1',  // Film & Animation (영화 리뷰/비평 등)
  '17', // Sports (스포츠 분석/해설)
  '20', // Gaming (게임 리뷰/논평/분석)
]);

export interface TitleGuardResult {
  isAnalyzable: boolean;
  reason?: string;
  evaluatedByAi: boolean;
}

/**
 * 🛡️ 1단계 초경량 Title Guard 게이트키퍼
 * - 안전 카테고리는 0초/0원으로 즉시 통과
 * - 코미디/엔터 등 모호 카테고리는 제목+채널명(80토큰, 약 0.0008원)만으로 사전 검문하여 자막 전문 AI 비용 낭비 원천 차단
 */
export async function evaluateTitleGatekeeper(
  channelName: string,
  title: string,
  categoryId?: string
): Promise<TitleGuardResult> {
  const catId = categoryId?.toString() || '';

  // 1) 안전 카테고리는 즉시 통과
  if (SAFE_PASS_CATEGORIES.has(catId)) {
    return { isAnalyzable: true, evaluatedByAi: false };
  }

  // 2) 음원/음악(10)은 무조건 즉시 차단
  if (catId === '10') {
    return {
      isAnalyzable: false,
      reason: '음악(M/V, 음원) 카테고리 영상은 분석 대상이 아닙니다.\n음악 평론·비평 영상은 정상 분석됩니다.',
      evaluatedByAi: false,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // API 키 미설정 시 안전하게 통과 (폴백)
    return { isAnalyzable: true, evaluatedByAi: false };
  }

  try {
    const client = new OpenAI({ apiKey });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const prompt = `[유튜브 콘텐츠 1단계 적합성 판별기]
다음 유튜브 채널명과 영상 제목을 보고, 이 영상이 정보성 분석 대상인지 판별하라.

[분석 대상 (O)]
- 코딩/IT/기술/소프트웨어 강의, 튜토리얼, 개발기 (코미디 카테고리에 등록된 경우 포함)
- 시사/정치/경제/사회 이슈 분석, 논평, 팩트체크
- 지식/교육/역사/과학 설명
- 제품/도서/영화/게임/자동차/부동산 등 리뷰 및 비평
- 노하우, 팁, 방법론, 분석적 인사이트 제공 영상

[분석 비대상 (X)]
- 순수 개그 꽁트, 몰래카메라, 슬랩스틱, 단순 숏폼 유머
- 단순 먹방(Mukbang), 브이로그(ASMR, 일상 브이로그)
- 단순 반려동물 귀여운 장면 모음 (훈련/수의학 정보가 아닌 경우)
- 가사 없는 배경음악, 단순 플레이 재생

[입력 정보]
- 카테고리 ID: ${catId || '미지정'}
- 채널명: ${channelName}
- 영상 제목: ${title}

반드시 다음 JSON 형식으로만 응답하라:
{
  "analyzable": true 또는 false,
  "reason": "판정 사유 (한글 1~2문장)"
}`;

    const response = await client.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 150,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a strict YouTube content gatekeeper. Output JSON only.' },
          { role: 'user', content: prompt },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const isAnalyzable = parsed.analyzable === true;
    const reason = parsed.reason || (isAnalyzable ? '정보성 콘텐츠' : '단순 오락/유머 콘텐츠');

    console.log(`[TitleGuard] cat=${catId}, channel=${channelName}, analyzable=${isAnalyzable}, reason=${reason}`);

    return {
      isAnalyzable,
      reason,
      evaluatedByAi: true,
    };
  } catch (err) {
    console.warn('[TitleGuard] 검문 타임아웃 또는 오류 - 안전 통과 폴백:', err);
    return { isAnalyzable: true, evaluatedByAi: false };
  }
}
