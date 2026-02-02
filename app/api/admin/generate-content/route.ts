import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { getCategoryName } from '@/lib/constants';

async function getMarketingData(dataSource: string) {
  const client = await pool.connect();
  try {
    switch (dataSource) {
      case 'category-gap':
        const categoryRes = await client.query(`
          SELECT
            f_official_category_id as id,
            COUNT(*) as video_count,
            AVG(f_avg_reliability) as avg_reliability
          FROM t_channel_stats
          WHERE f_video_count > 5 -- 통계적 유의성을 위해 최소 5개 이상 영상이 있는 채널만
          GROUP BY f_official_category_id
          HAVING COUNT(*) > 3 -- 최소 3개 이상 채널이 있는 카테고리만
          ORDER BY avg_reliability DESC;
        `);

        if (categoryRes.rows.length < 2) {
          return { type: '카테고리별 신뢰도 격차', data: '아직 비교할 만큼 충분한 데이터가 쌓이지 않았습니다.' };
        }

        const topCategory = categoryRes.rows[0];
        const bottomCategory = categoryRes.rows[categoryRes.rows.length - 1];
        const gap = Math.round(topCategory.avg_reliability - bottomCategory.avg_reliability);

        const topCategoryName = getCategoryName(Number(topCategory.id));
        const bottomCategoryName = getCategoryName(Number(bottomCategory.id));

        return {
          type: '카테고리별 신뢰도 격차',
          data: `신뢰도 점수가 가장 높은 카테고리인 '${topCategoryName}'는(은) 평균 ${Math.round(topCategory.avg_reliability)}점, 가장 낮은 카테고리인 '${bottomCategoryName}'는(은) ${Math.round(bottomCategory.avg_reliability)}점으로, ${gap}점의 격차를 보였습니다.`,
        };

      case 'channel-rank':
        const rankRes = await client.query(`
          WITH million_channels AS (
            SELECT f_id FROM t_channels WHERE f_subscriber_count >= 1000000
          ),
          latest_analyses AS (
            SELECT DISTINCT ON (f_channel_id)
              f_channel_id, f_reliability_score
            FROM t_analyses
            WHERE f_channel_id IN (SELECT f_id FROM million_channels)
              AND f_is_latest = TRUE
            ORDER BY f_channel_id, f_created_at DESC
          )
          SELECT
            COUNT(*) as total_million_channels,
            COUNT(CASE WHEN f_reliability_score <= 39 THEN 1 END) as f_grade_channels
          FROM latest_analyses;
        `);

        if (rankRes.rows.length === 0 || rankRes.rows[0].total_million_channels === 0) {
          return { type: '채널별 등급 분포', data: '구독자 100만 이상 채널에 대한 데이터가 부족합니다.' };
        }

        const { total_million_channels, f_grade_channels } = rankRes.rows[0];
        const percentage = Math.round((f_grade_channels / total_million_channels) * 100);

        return {
          type: '채널별 등급 분포',
          data: `구독자 100만 이상 채널 ${total_million_channels}개 중, ${f_grade_channels}개(${percentage}%)가 F등급(신뢰도 39점 이하)으로 분석되었습니다.`,
        };

      case 'keyword-trend':
        const trendRes = await client.query(`
          SELECT f_title
          FROM t_analyses
          WHERE f_created_at >= NOW() - INTERVAL '7 days'
            AND f_clickbait_score >= 61; -- 61점 이상(허위/날조) 영상 대상
        `);

        if (trendRes.rows.length < 5) {
          return { type: '주간 낚시 키워드 트렌드', data: '분석할 만큼 충분한 낚시성 영상 데이터가 쌓이지 않았습니다.' };
        }

        const titles = trendRes.rows.map(r => r.f_title).join(' ');
        const words = titles.split(/[\s,.'"!?\[\]{}()]+/);
        const stopWords = new Set(['이', '가', '은', '는', '의', '에', '을', '를', '와', '과', '수', '것', '등', '및', '저', '저희', '그', '그녀', '우리', '너', '당신']);
        const wordCounts: { [key: string]: number } = {};

        for (const word of words) {
          if (word.length > 1 && !stopWords.has(word) && !/\d+/.test(word)) { // 1글자 이상, 불용어 제외, 숫자 제외
            wordCounts[word] = (wordCounts[word] || 0) + 1;
          }
        }

        const sortedKeywords = Object.entries(wordCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([word]) => word);

        return {
          type: '주간 낚시 키워드 트렌드',
          data: `이번 주 가장 많이 사용된 낚시성 키워드는 '${sortedKeywords.join("', '")}' 입니다.`,
        };

      default:
        throw new Error('Invalid data source');
    }
  } finally {
    client.release();
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
