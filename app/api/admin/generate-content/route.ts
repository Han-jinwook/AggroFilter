import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// This function will be expanded to fetch real data from the database
async function getMarketingData(dataSource: string) {
  // For now, we use mock data based on the plan.
  // TODO: Implement actual database queries.
  switch (dataSource) {
    case 'category-gap':
      return {
        type: '카테고리별 신뢰도 격차',
        data: '경제 유튜버의 평균 신뢰도는 75점, 게임 유튜버는 60점으로 15점의 격차를 보였습니다.',
      };
    case 'channel-rank':
      return {
        type: '채널별 등급 분포',
        data: '구독자 100만 이상 채널 중 15%가 F등급(위험)으로 분석되었습니다.',
      };
    case 'keyword-trend':
      return {
        type: '주간 낚시 키워드 트렌드',
        data: "이번 주 가장 많이 사용된 낚시성 키워드는 '폭락', '긴급', '단독' 입니다.",
      };
    default:
      throw new Error('Invalid data source');
  }
}

function getAIPrompt(contentType: string, marketingData: any) {
  switch (contentType) {
    case 'press-release':
      return `
        # 페르소나: 전문 IT 기자
        # 지시: 아래 데이터를 바탕으로, 유튜브 생태계의 현황과 문제점을 꼬집는 1,500자 분량의 전문적인 칼럼을 작성해줘. 독자들이 흥미를 느끼면서도 데이터에 기반한 신뢰감을 느낄 수 있도록 세련된 문체로 작성해줘.

        # 데이터
        - 주제: ${marketingData.type}
        - 핵심 내용: ${marketingData.data}

        # 출력 형식:
        - 제목: [주목도 높은 제목]
        - 본문: [서론, 본론, 결론 구조를 갖춘 칼럼]
      `;
    case 'short-form':
      return `
        # 페르소나: 바이럴 전문 숏폼 크리에이터
        # 지시: 아래 데이터를 활용해서, 시청자의 시선을 3초 안에 사로잡는 60초 분량의 유튜브 쇼츠/릴스 대본을 작성해줘. '당신이 몰랐던 사실', 'TOP 3' 와 같은 형식을 사용해서 흥미를 유발하고, 마지막에는 '어그로필터' 앱을 자연스럽게 언급해줘.

        # 데이터
        - 주제: ${marketingData.type}
        - 핵심 내용: ${marketingData.data}

        # 출력 형식:
        - 오프닝 (3초): [강력한 한 문장]
        - 본문: [핵심 내용을 3가지 포인트로 나누어 설명]
        - 클로징: [행동 유도 문구 + '어그로필터' 언급]
      `;
    default:
      throw new Error('Invalid content type');
  }
}

export async function POST(request: Request) {
  try {
    const { contentType, dataSource } = await request.json();

    if (!contentType || !dataSource) {
      return NextResponse.json({ error: '콘텐츠 유형과 데이터 소스를 모두 선택해야 합니다.' }, { status: 400 });
    }

    // 1. Fetch data from DB (or use mock for now)
    const marketingData = await getMarketingData(dataSource);

    // 2. Construct AI prompt
    const prompt = getAIPrompt(contentType, marketingData);

    // 3. Call AI to generate content
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY is not set");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const result = await model.generateContent(prompt);
    const generatedContent = await result.response.text();

    return NextResponse.json({ content: generatedContent });

  } catch (error) {
    console.error('콘텐츠 생성 오류:', error);
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    return NextResponse.json({ error: `콘텐츠 생성 중 오류가 발생했습니다: ${message}` }, { status: 500 });
  }
}
