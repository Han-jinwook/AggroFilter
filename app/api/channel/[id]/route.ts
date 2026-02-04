import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCategoryName } from '@/lib/categoryMap';

export const runtime = 'nodejs';

// 구독자 수 포맷팅 함수
function formatSubscribers(count: number): string {
  if (count >= 10000000) return `${Math.floor(count / 10000000)}천만`;
  if (count >= 10000) return `${Math.floor(count / 10000)}만`;
  return count.toString();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params;

    const client = await pool.connect();
    try {
      // 1. 채널 기본 정보 조회
      const channelResult = await client.query(`
        SELECT 
          COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id') as f_id,
          COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') as f_name,
          COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url') as f_profile_image_url,
          COALESCE((to_jsonb(c)->>'f_subscriber_count')::bigint, 0) as f_subscriber_count,
          COALESCE(to_jsonb(c)->>'f_handle', NULL) as f_handle
        FROM t_channels c
        WHERE COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id') = $1
      `, [channelId]);

      if (channelResult.rows.length === 0) {
        console.log(`Channel not found: ${channelId}`);
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      }

      const channel = channelResult.rows[0];
      console.log(`Channel found: ${channel.f_name} (${channelId})`);

      // 2. 채널의 전체 분석 수 및 평균 신뢰도 조회
      // [v2.2 Optimization] Use f_is_latest = true instead of CTE
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_analysis,
          ROUND(AVG(f_reliability_score)) as avg_reliability,
          ROUND(AVG(f_accuracy_score)) as avg_accuracy,
          ROUND(AVG(f_clickbait_score)) as avg_clickbait
        FROM t_analyses
        WHERE f_channel_id = $1
          AND f_is_latest = TRUE
      `, [channelId]);

      const stats = statsResult.rows[0];
      console.log(`Stats: ${stats.total_analysis} analyses, avg reliability: ${stats.avg_reliability}`);

      // 분석 데이터가 없으면 기본값 반환
      if (parseInt(stats.total_analysis) === 0) {
        return NextResponse.json({
          id: channel.f_id,
          name: channel.f_name,
          subscribers: formatSubscribers(channel.f_subscriber_count || 0),
          totalAnalysis: 0,
          profileImage: channel.f_profile_image_url,
          handle: channel.f_handle,
          trustScore: 0,
          stats: {
            accuracy: 0,
            aggro: 'Low',
            trend: 'Stable',
            trendData: []
          },
          topics: []
        });
      }

      // 3. 신뢰도 트렌드 데이터 (최근 7개 분석)
      // [v2.2 Optimization] Use f_is_latest = true
      const trendResult = await client.query(`
        SELECT f_reliability_score
        FROM t_analyses
        WHERE f_channel_id = $1
          AND f_is_latest = TRUE
        ORDER BY f_created_at DESC
        LIMIT 7
      `, [channelId]);

      const trendData = trendResult.rows.map(r => r.f_reliability_score).reverse();

      // 4. 카테고리별 분석 데이터
      // [v2.2 Optimization] Use f_is_latest = true
      const topicsResult = await client.query(`
        SELECT 
          a.f_official_category_id,
          COUNT(*) as video_count,
          ROUND(AVG(a.f_reliability_score)) as avg_score,
          json_agg(
            json_build_object(
              'id', a.f_id,
              'videoId', a.f_video_id,
              'url', a.f_video_url,
              'title', a.f_title,
              'date', TO_CHAR(a.f_created_at, 'YY.MM.DD'),
              'score', a.f_reliability_score,
              'thumbnail', a.f_thumbnail_url,
              'views', '0'
            ) ORDER BY a.f_created_at DESC
          ) as videos
        FROM t_analyses a
        WHERE a.f_channel_id = $1
          AND a.f_is_latest = TRUE
        GROUP BY a.f_official_category_id
        ORDER BY video_count DESC
      `, [channelId]);

      // 5. 각 카테고리별 랭킹 정보 조회 (t_channel_stats 대신 직접 계산)
      const topicsWithRank = await Promise.all(
        topicsResult.rows.map(async (topic) => {
          // 해당 카테고리의 모든 채널 평균 신뢰도 계산하여 랭킹 산출
          // [v2.2 Optimization] Use f_is_latest = true
          const rankResult = await client.query(`
            WITH channel_avg AS (
              SELECT 
                f_channel_id,
                AVG(f_reliability_score) as avg_reliability
              FROM t_analyses
              WHERE f_official_category_id = $1
                AND f_is_latest = TRUE
              GROUP BY f_channel_id
            ),
            ranked_channels AS (
              SELECT 
                f_channel_id,
                ROW_NUMBER() OVER (ORDER BY avg_reliability DESC) as rank,
                COUNT(*) OVER () as total_count
              FROM channel_avg
            )
            SELECT rank, total_count
            FROM ranked_channels
            WHERE f_channel_id = $2
          `, [topic.f_official_category_id, channelId]);

          const rankInfo = rankResult.rows[0] || { rank: null, total_count: 0 };
          const rankPercent = rankInfo.rank && rankInfo.total_count > 0
            ? Math.ceil((rankInfo.rank / rankInfo.total_count) * 100)
            : null;

          return {
            categoryId: topic.f_official_category_id,
            name: getCategoryName(topic.f_official_category_id),
            count: parseInt(topic.video_count),
            score: parseInt(topic.avg_score),
            rank: rankInfo.rank ? parseInt(rankInfo.rank) : null,
            totalChannels: parseInt(rankInfo.total_count),
            rankPercent: rankPercent,
            videos: topic.videos.slice(0, 10) // 최대 10개만
          };
        })
      );

      // 6. 어그로 등급 계산
      const avgClickbait = parseInt(stats.avg_clickbait) || 0;
      let aggroLevel = 'Low';
      if (avgClickbait >= 60) aggroLevel = 'High';
      else if (avgClickbait >= 30) aggroLevel = 'Medium';

      // 7. 트렌드 방향 계산
      let trend = 'Stable';
      if (trendData.length >= 2) {
        const recent = trendData[trendData.length - 1];
        const previous = trendData[0];
        if (recent > previous + 5) trend = 'Rising';
        else if (recent < previous - 5) trend = 'Falling';
      }

      const responseData = {
        id: channel.f_id,
        name: channel.f_name,
        subscribers: formatSubscribers(channel.f_subscriber_count || 0),
        totalAnalysis: parseInt(stats.total_analysis) || 0,
        profileImage: channel.f_profile_image_url,
        handle: channel.f_handle,
        trustScore: parseInt(stats.avg_reliability) || 0,
        stats: {
          accuracy: parseInt(stats.avg_accuracy) || 0,
          aggro: aggroLevel,
          trend: trend,
          trendData: trendData
        },
        topics: topicsWithRank.filter(t => t.count > 0)
      };

      return NextResponse.json(responseData);

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Channel API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
