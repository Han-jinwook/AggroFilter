import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getLanguageDisplayName, getLanguageIcon } from '@/lib/language-detection';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'korean';
  const categoryId = searchParams.get('category');
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10);
  const focusChannelId = searchParams.get('channelId');

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 10000) : 1000;
  const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;
  
  // Ranking Key 생성: lang_categoryId 또는 언어 전체
  const hasCategory = categoryId && categoryId !== '' && categoryId !== 'all';
  const rankingKey = hasCategory ? `${lang}_${categoryId}` : null;

  try {
    const client = await pool.connect();
    try {
      // t_rankings_cache에서 조회
      let query: string;
      let queryParams: any[];
      
      if (rankingKey) {
        // 특정 카테고리만 조회
        query = `
          SELECT 
            rc.f_channel_id as id,
            rc.f_rank as rank,
            c.f_title as name,
            c.f_thumbnail_url as avatar,
            cs.f_avg_reliability as score,
            cs.f_avg_clickbait as clickbait_score,
            rc.f_total_count as total_count,
            rc.f_top_percentile as top_percentile,
            (
              SELECT COUNT(*)::int FROM t_analyses a
              WHERE a.f_channel_id = rc.f_channel_id
                AND a.f_is_latest = TRUE
            ) as analysis_count
          FROM t_rankings_cache rc
          JOIN t_channels c ON rc.f_channel_id = c.f_channel_id
          LEFT JOIN t_channel_stats cs ON rc.f_channel_id = cs.f_channel_id AND cs.f_official_category_id = rc.f_category_id
          WHERE rc.f_ranking_key = $1
          ORDER BY rc.f_rank ASC
          LIMIT $2 OFFSET $3
        `;
        queryParams = [rankingKey, safeLimit, safeOffset];
      } else {
        // 언어별 전체 조회 (채널별 최고 점수 기준)
        query = `
          WITH ChannelBestScores AS (
            SELECT DISTINCT ON (rc.f_channel_id)
              rc.f_channel_id,
              c.f_title,
              c.f_thumbnail_url,
              cs.f_avg_reliability,
              cs.f_avg_clickbait,
              rc.f_language
            FROM t_rankings_cache rc
            JOIN t_channels c ON rc.f_channel_id = c.f_channel_id
            LEFT JOIN t_channel_stats cs ON rc.f_channel_id = cs.f_channel_id AND cs.f_official_category_id = rc.f_category_id
            WHERE rc.f_language = $1
            ORDER BY rc.f_channel_id, cs.f_avg_reliability DESC NULLS LAST
          ),
          RankedByLanguage AS (
            SELECT 
              f_channel_id,
              f_title,
              f_thumbnail_url,
              f_avg_reliability,
              f_avg_clickbait,
              ROW_NUMBER() OVER (ORDER BY f_avg_reliability DESC NULLS LAST) as overall_rank,
              COUNT(*) OVER () as total_count
            FROM ChannelBestScores
          )
          SELECT 
            f_channel_id as id,
            overall_rank as rank,
            f_title as name,
            f_thumbnail_url as avatar,
            f_avg_reliability as score,
            f_avg_clickbait as clickbait_score,
            total_count,
            ROUND((overall_rank::decimal / total_count::decimal) * 100, 2) as top_percentile,
            (
              SELECT COUNT(*)::int FROM t_analyses a
              WHERE a.f_channel_id = RankedByLanguage.f_channel_id
                AND a.f_is_latest = TRUE
            ) as analysis_count
          FROM RankedByLanguage
          ORDER BY overall_rank ASC
          LIMIT $2 OFFSET $3
        `;
        queryParams = [lang, safeLimit, safeOffset];
      }
      
      const res = await client.query(query, queryParams);
      const totalCount = res.rows[0]?.total_count || 0;

      const rankedChannels = res.rows.map((row) => ({
        id: row.id,
        rank: row.rank, // 캐시에서 가져온 rank 사용
        name: row.name,
        avatar: row.avatar,
        score: Number.parseFloat(row.score || 0),
        clickbaitScore: Number.parseFloat(row.clickbait_score || 0),
        categoryId: categoryId ? Number.parseInt(categoryId, 10) : 0,
        analysisCount: row.analysis_count || 0,
      }));

      const nextOffset = safeOffset + rankedChannels.length < totalCount ? safeOffset + rankedChannels.length : null;

      let focusRank: any = null;

      if (focusChannelId) {
        try {
          let focusQuery: string;
          let focusParams: any[];
          
          if (rankingKey) {
            focusQuery = `
              SELECT 
                rc.f_channel_id as id,
                rc.f_rank as rank,
                c.f_title as name,
                c.f_thumbnail_url as avatar,
                cs.f_avg_reliability as score,
                rc.f_total_count as total_count,
                rc.f_top_percentile as top_percentile
              FROM t_rankings_cache rc
              JOIN t_channels c ON rc.f_channel_id = c.f_channel_id
              LEFT JOIN t_channel_stats cs ON rc.f_channel_id = cs.f_channel_id AND cs.f_official_category_id = rc.f_category_id
              WHERE rc.f_channel_id = $1 AND rc.f_ranking_key = $2
              LIMIT 1
            `;
            focusParams = [focusChannelId, rankingKey];
          } else {
            focusQuery = `
              SELECT 
                rc.f_channel_id as id,
                rc.f_rank as rank,
                c.f_title as name,
                c.f_thumbnail_url as avatar,
                cs.f_avg_reliability as score,
                rc.f_total_count as total_count,
                rc.f_top_percentile as top_percentile
              FROM t_rankings_cache rc
              JOIN t_channels c ON rc.f_channel_id = c.f_channel_id
              LEFT JOIN t_channel_stats cs ON rc.f_channel_id = cs.f_channel_id AND cs.f_official_category_id = rc.f_category_id
              WHERE rc.f_channel_id = $1 AND rc.f_language = $2
              ORDER BY rc.f_rank ASC
              LIMIT 1
            `;
            focusParams = [focusChannelId, lang];
          }
          
          const focusRes = await client.query(focusQuery, focusParams);
          
          if (focusRes.rows.length > 0) {
            const row = focusRes.rows[0];
            focusRank = {
              id: row.id,
              rank: Number(row.rank),
              name: row.name,
              avatar: row.avatar,
              score: Number.parseFloat(row.score || 0),
              categoryId: categoryId ? Number.parseInt(categoryId, 10) : 0,
              totalCount: Number(row.total_count),
              topPercentile: Number(row.top_percentile),
            };
          }
        } catch (e) {
          console.error('[Ranking API] focusRank query failed:', e);
        }
      }

      return NextResponse.json({
        channels: rankedChannels,
        totalCount,
        nextOffset,
        focusRank,
        locale: {
          language: lang,
          displayName: getLanguageDisplayName(lang),
          icon: getLanguageIcon(lang),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ranking API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
