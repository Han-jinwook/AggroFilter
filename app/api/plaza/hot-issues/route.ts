import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCached, setCache } from '@/lib/plaza-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'trust';
    const direction = searchParams.get('direction') || 'desc';
    const lang = searchParams.get('lang') || 'korean';

    const cacheKey = `hot-issues:${sort}:${direction}:${lang}`;
    const cached = getCached<{ hotIssues: any[]; lastUpdated: string }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const client = await pool.connect();
    try {
      // Base query condition: 최근 24?�간 ???�동(분석 + 조회)???�는 ?�상
      let orderByClause = 'ORDER BY a.f_reliability_score DESC';

      if (sort === 'trust') {
        orderByClause = direction === 'asc' 
          ? 'ORDER BY a.f_reliability_score ASC' 
          : 'ORDER BY a.f_reliability_score DESC';
      } else if (sort === 'aggro') {
        orderByClause = direction === 'asc'
          ? 'ORDER BY a.f_clickbait_score ASC'
          : 'ORDER BY a.f_clickbait_score DESC';
      }

      // [v2.2 Optimization] Use f_is_latest = true + language filter
      const query = `
        SELECT 
          a.f_id as id,
          a.f_title as title,
          c.f_title as channel,
          c.f_thumbnail_url as "channelIcon",
          a.f_official_category_id as category_id,
          a.f_reliability_score as reliability_score,
          a.f_clickbait_score as clickbait_score
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
        WHERE a.f_is_latest = TRUE
          AND a.f_last_action_at >= NOW() - INTERVAL '24 hours'
          AND a.f_reliability_score IS NOT NULL
          AND COALESCE(c.f_language, 'korean') = $1
          AND a.f_is_valid = TRUE
          AND a.f_needs_review = FALSE
        ${orderByClause}
        LIMIT 3
      `;

      const result = await client.query(query, [lang]);

      const hotIssues = result.rows.map((row, index) => {
        let score = row.reliability_score;
        if (sort === 'aggro') {
            score = row.clickbait_score;
        }

        return {
          id: row.id,
          rank: index + 1,
          title: row.title,
          channel: row.channel || '?????�는 채널',
          channelIcon: row.channelIcon || '/placeholder.svg',
          category_id: row.category_id,
          score: score
        };
      });

      const responseData = {
        hotIssues,
        lastUpdated: new Date().toISOString()
      };
      setCache(cacheKey, responseData);
      return NextResponse.json(responseData);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Hot Issue API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch hot issues' }, { status: 500 });
  }
}
