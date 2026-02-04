import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '1주일';
    const sort = searchParams.get('sort') || 'date';
    const direction = searchParams.get('direction') || 'desc';

    let timeCondition = "a.f_created_at >= NOW() - INTERVAL '7 days'";
    
    if (period === '1일') {
      timeCondition = "a.f_last_action_at >= NOW() - INTERVAL '24 hours'";
    } else if (period === '1개월') {
      timeCondition = "a.f_created_at >= NOW() - INTERVAL '1 month'";
    }

    const client = await pool.connect();
    try {
        let orderBy = 'a.f_created_at DESC';
        if (sort === 'views') {
          orderBy = `(COALESCE(a.f_view_count, 0) + COALESCE(a.f_request_count, 0)) ${direction === 'asc' ? 'ASC' : 'DESC'}`;
        } else if (sort === 'score') {
          orderBy = `a.f_reliability_score ${direction === 'asc' ? 'ASC' : 'DESC'}`;
        } else if (sort === 'date') {
          orderBy = `a.f_created_at ${direction === 'asc' ? 'ASC' : 'DESC'}`;
        }

      // First, try with the strict time condition
      // [v2.2 Optimization] Use f_is_latest = true instead of CTE
      let query = `
        SELECT 
          a.f_id as id,
          a.f_created_at as date,
          a.f_title as title,
          COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') as channel,
          COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url') as "channelIcon",
          a.f_request_count as views,
          a.f_view_count as f_view_count,
          a.f_reliability_score as score
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id')
        WHERE a.f_is_latest = TRUE
          AND ${timeCondition}
          AND a.f_reliability_score IS NOT NULL
        ORDER BY ${orderBy}
        LIMIT 50
      `;

      let result = await client.query(query);

      // Fail-safe: If '1일' is selected and no results found, fallback to '7 days' but keep the '1일' label
      if (period === '1일' && result.rows.length === 0) {
        query = `
          SELECT 
            a.f_id as id,
            a.f_created_at as date,
            a.f_title as title,
            COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') as channel,
            COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url') as "channelIcon",
            a.f_request_count as views,
            a.f_view_count as f_view_count,
            a.f_reliability_score as score
          FROM t_analyses a
          LEFT JOIN t_channels c ON a.f_channel_id = COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id')
          WHERE a.f_is_latest = TRUE
            AND a.f_created_at >= NOW() - INTERVAL '7 days'
            AND a.f_reliability_score IS NOT NULL
          ORDER BY ${orderBy}
          LIMIT 50
        `;
        result = await client.query(query);
      }

      const videos = result.rows.map(row => {
        // Combine analysis_count and view_count
        const totalEngagement = (row.views || 0) + (row.f_view_count || 0);
        
        return {
          id: row.id,
          date: new Date(row.date).toISOString(),
          title: row.title,
          channel: row.channel || '알 수 없는 채널',
          channelIcon: row.channelIcon || '/placeholder.svg',
          analysis_count: row.views || 0,
          view_count: row.f_view_count || 0,
          views: totalEngagement.toLocaleString(),
          score: row.score,
          color: row.score >= 70 ? 'green' : 'red'
        };
      });

      return NextResponse.json({ videos });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Plaza Videos API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
