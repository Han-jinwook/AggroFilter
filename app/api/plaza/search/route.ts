import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get('q') || '').trim();
    const sort = searchParams.get('sort') || 'clean'; // clean | toxic
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 100);

    if (!keyword) {
      return NextResponse.json({ results: [], keyword: '' });
    }

    const client = await pool.connect();
    try {
      const likePattern = `%${keyword}%`;

      const orderBy = sort === 'toxic'
        ? 'a.f_clickbait_score DESC NULLS LAST'
        : 'a.f_clickbait_score ASC NULLS LAST';

      const query = `
        SELECT 
          a.f_id as id,
          a.f_title as title,
          a.f_video_id as video_id,
          a.f_thumbnail_url as thumbnail,
          a.f_created_at as date,
          a.f_accuracy_score as accuracy,
          a.f_clickbait_score as clickbait,
          a.f_reliability_score as reliability,
          c.f_title as channel,
          c.f_thumbnail_url as channel_icon,
          c.f_channel_id as channel_id
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
        WHERE a.f_is_latest = TRUE
          AND a.f_reliability_score IS NOT NULL
          AND (
            a.f_title ILIKE $1
            OR c.f_title ILIKE $1
          )
        ORDER BY ${orderBy}
        LIMIT $2
      `;

      const result = await client.query(query, [likePattern, limit]);

      const results = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        videoId: row.video_id,
        thumbnail: row.thumbnail,
        date: new Date(row.date).toISOString(),
        accuracy: row.accuracy,
        clickbait: row.clickbait,
        reliability: row.reliability,
        channel: row.channel || '알 수 없는 채널',
        channelIcon: row.channel_icon || '/placeholder.svg',
        channelId: row.channel_id,
        color: row.reliability >= 70 ? 'green' : 'red'
      }));

      return NextResponse.json({
        results,
        keyword,
        sort,
        totalCount: results.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Plaza Search API Error:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
