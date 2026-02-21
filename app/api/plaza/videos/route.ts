import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCached, setCache } from '@/lib/plaza-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '';
    const sort = searchParams.get('sort') || 'date';
    const direction = searchParams.get('direction') || 'desc';
    const lang = searchParams.get('lang') || 'korean';

    const cacheKey = `videos:${period}:${sort}:${direction}:${lang}`;
    const cached = getCached<{ videos: any[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    let timeCondition = "TRUE";
    
    if (period === '1일') {
      timeCondition = "a.f_last_action_at >= NOW() - INTERVAL '24 hours'";
    } else if (period === '1주일') {
      timeCondition = "a.f_created_at >= NOW() - INTERVAL '7 days'";
    } else if (period === '1개월') {
      timeCondition = "a.f_created_at >= NOW() - INTERVAL '1 month'";
    }

    const client = await pool.connect();
    try {
        let orderBy = 'a.f_created_at DESC';
        if (sort === 'score') {
          orderBy = `a.f_reliability_score ${direction === 'asc' ? 'ASC' : 'DESC'}`;
        } else if (sort === 'clickbait') {
          orderBy = `a.f_clickbait_score ${direction === 'asc' ? 'ASC' : 'DESC'}`;
        } else if (sort === 'date') {
          orderBy = `a.f_created_at ${direction === 'asc' ? 'ASC' : 'DESC'}`;
        }

      // First, try with the strict time condition
      // [v2.2 Optimization] Use f_is_latest = true instead of CTE + language filter
      let query = `
        SELECT 
          a.f_id as id,
          a.f_created_at as date,
          a.f_title as title,
          c.f_title as channel,
          c.f_thumbnail_url as "channelIcon",
          a.f_clickbait_score as clickbait,
          a.f_reliability_score as score
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
        WHERE a.f_is_latest = TRUE
          AND ${timeCondition}
          AND a.f_reliability_score IS NOT NULL
          AND COALESCE(c.f_language, 'korean') = $1
        ORDER BY ${orderBy}
        LIMIT 200
      `;

      let result = await client.query(query, [lang]);

      const videos = result.rows.map(row => {
        return {
          id: row.id,
          date: new Date(row.date).toISOString(),
          title: row.title,
          channel: row.channel || '알 수 없는 채널',
          channelIcon: row.channelIcon || '/placeholder.svg',
          clickbait: row.clickbait || 0,
          score: row.score,
          color: row.score >= 70 ? 'green' : 'red'
        };
      });

      const responseData = { videos };
      setCache(cacheKey, responseData);
      return NextResponse.json(responseData);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Plaza Videos API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
