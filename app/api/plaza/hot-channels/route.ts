import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCategoryName } from '@/lib/categoryMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'trust'; // trust, controversy
    const direction = searchParams.get('direction') || 'desc';

    const client = await pool.connect();
    try {
      let orderByClause = 'ORDER BY cs.f_avg_reliability DESC';

      if (filter === 'trust') {
        orderByClause = direction === 'asc' 
          ? 'ORDER BY cs.f_avg_reliability ASC' 
          : 'ORDER BY cs.f_avg_reliability DESC';
      } else if (filter === 'controversy') {
        orderByClause = direction === 'asc'
          ? 'ORDER BY cs.f_avg_clickbait ASC'
          : 'ORDER BY cs.f_avg_clickbait DESC';
      }

      // Use t_channel_stats for ranking data
      const query = `
        SELECT 
          c.f_channel_id as id,
          c.f_title as name,
          c.f_thumbnail_url as "channelIcon",
          cs.f_official_category_id as category_id,
          cs.f_avg_reliability,
          cs.f_avg_clickbait,
          cs.f_last_updated
        FROM t_channel_stats cs
        JOIN t_channels c ON cs.f_channel_id = c.f_channel_id
        WHERE cs.f_last_updated >= NOW() - INTERVAL '7 days'
          AND cs.f_avg_reliability IS NOT NULL
        ${orderByClause}
        LIMIT 3
      `;

      const result = await client.query(query);

      const hotChannels = result.rows.map((row, index) => {
        let score = Math.round(row.avg_reliability || 0);
        let value = score;
        
        if (filter === 'controversy') {
          score = Math.round(row.avg_clickbait || 0);
          value = score;
        }

        return {
          id: row.id,
          rank: index + 1,
          name: row.name,
          channelIcon: row.channelIcon || '/placeholder.svg',
          topic: getCategoryName(row.category_id),
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
