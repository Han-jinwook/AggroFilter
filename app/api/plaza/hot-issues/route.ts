import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const revalidate = 3600; // Cache for 1 hour

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'views';
    const direction = searchParams.get('direction') || 'desc';

    const client = await pool.connect();
    try {
      // Base query condition: Activity within last 24 hours
      let orderByClause = 'ORDER BY a.f_request_count DESC, a.f_view_count DESC';

      if (sort === 'trust') {
        orderByClause = direction === 'asc' 
          ? 'ORDER BY a.f_reliability_score ASC' 
          : 'ORDER BY a.f_reliability_score DESC';
      } else if (sort === 'aggro') {
        orderByClause = direction === 'asc'
          ? 'ORDER BY a.f_clickbait_score ASC'
          : 'ORDER BY a.f_clickbait_score DESC';
      }

      const query = `
        SELECT 
          a.f_id as id,
          a.f_title as title,
          c.f_name as channel,
          a.f_topic as topic,
          a.f_reliability_score as reliability_score,
          a.f_clickbait_score as clickbait_score,
          a.f_request_count as analysis_count,
          a.f_view_count as view_count
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_id
        WHERE a.f_last_action_at >= NOW() - INTERVAL '24 hours'
          AND a.f_reliability_score IS NOT NULL
        ${orderByClause}
        LIMIT 3
      `;

      const result = await client.query(query);

      const hotIssues = result.rows.map((row, index) => {
        let score = row.reliability_score;
        if (sort === 'aggro') {
            score = row.clickbait_score;
        }

        return {
          id: row.id,
          rank: index + 1,
          title: row.title,
          channel: row.channel || 'Unknown Channel',
          topic: row.topic,
          views: row.analysis_count?.toLocaleString() || '0',
          score: score
        };
      });

      return NextResponse.json({ 
        hotIssues,
        lastUpdated: new Date().toISOString()
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Hot Issue API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch hot issues' }, { status: 500 });
  }
}
