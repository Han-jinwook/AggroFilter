import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'views'; // views, trust, controversy
    const direction = searchParams.get('direction') || 'desc';

    const client = await pool.connect();
    try {
      let orderByClause = 'ORDER BY analysis_count DESC, view_count DESC';

      if (filter === 'trust') {
        orderByClause = direction === 'asc' 
          ? 'ORDER BY avg_reliability ASC' 
          : 'ORDER BY avg_reliability DESC';
      } else if (filter === 'controversy') {
        orderByClause = direction === 'asc'
          ? 'ORDER BY avg_clickbait ASC'
          : 'ORDER BY avg_clickbait DESC';
      }

      // [v2.2 Optimization] Use f_is_latest = true
      const query = `
        SELECT 
          c.f_id as id,
          c.f_name as name,
          c.f_profile_image_url as "channelIcon",
          COUNT(a.f_id) as analysis_count,
          SUM(COALESCE(a.f_view_count, 0)) as view_count,
          AVG(a.f_reliability_score) as avg_reliability,
          AVG(a.f_clickbait_score) as avg_clickbait
        FROM t_channels c
        JOIN t_analyses a ON c.f_id = a.f_channel_id
        WHERE a.f_is_latest = TRUE
          AND a.f_created_at >= NOW() - INTERVAL '7 days'
        GROUP BY c.f_id, c.f_name, c.f_profile_image_url
        HAVING COUNT(a.f_id) > 0
        ${orderByClause}
        LIMIT 3
      `;

      const result = await client.query(query);

      const hotChannels = result.rows.map((row, index) => {
        let value = row.analysis_count;
        let score = Math.round(row.avg_reliability || 0);
        
        if (filter === 'trust') {
          value = score;
        } else if (filter === 'controversy') {
          score = Math.round(row.avg_clickbait || 0);
          value = score;
        }

        return {
          id: row.id,
          rank: index + 1,
          name: row.name,
          channelIcon: row.channelIcon || '/placeholder.svg',
          value: value.toString(),
          score: score,
          color: score >= 70 ? 'green' : (score <= 40 ? 'red' : 'blue')
        };
      });

      return NextResponse.json({ hotChannels });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Hot Channels API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch hot channels' }, { status: 500 });
  }
}
