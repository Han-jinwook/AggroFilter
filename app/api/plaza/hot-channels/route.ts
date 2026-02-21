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
    const lang = searchParams.get('lang') || 'korean';

    const client = await pool.connect();
    try {
      let orderByClause = 'ORDER BY max_reliability DESC';

      if (filter === 'trust') {
        orderByClause = direction === 'asc' 
          ? 'ORDER BY max_reliability ASC' 
          : 'ORDER BY max_reliability DESC';
      } else if (filter === 'controversy') {
        orderByClause = direction === 'asc'
          ? 'ORDER BY max_clickbait ASC'
          : 'ORDER BY max_clickbait DESC';
      }

      // Use t_channel_stats with language filter and channel deduplication
      const query = `
        SELECT 
          c.f_channel_id as id,
          c.f_title as name,
          c.f_thumbnail_url as "channelIcon",
          cs.f_official_category_id as category_id,
          cs.f_avg_reliability as max_reliability,
          cs.f_avg_clickbait as max_clickbait,
          cs.f_video_count as video_count
        FROM (
          SELECT 
            f_channel_id,
            f_official_category_id,
            f_avg_reliability,
            f_avg_clickbait,
            f_video_count,
            ROW_NUMBER() OVER (PARTITION BY f_channel_id ORDER BY f_avg_reliability DESC) as rn
          FROM t_channel_stats
          WHERE f_language = $1
            AND f_last_updated >= NOW() - INTERVAL '7 days'
            AND f_avg_reliability IS NOT NULL
        ) cs
        JOIN t_channels c ON cs.f_channel_id = c.f_channel_id
        WHERE cs.rn = 1
        ${orderByClause}
        LIMIT 3
      `;

      const result = await client.query(query, [lang]);

      const hotChannels = result.rows.map((row, index) => {
        let score = Math.round(row.max_reliability || 0);
        let value = score;
        
        if (filter === 'controversy') {
          score = Math.round(row.max_clickbait || 0);
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
          videoCount: row.video_count || 0,
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
