import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { ids, email } = await request.json();

    const safeIds = (ids && Array.isArray(ids)) ? ids : [];

    if (safeIds.length === 0 && !email) {
      return NextResponse.json({ videos: [] });
    }

    const client = await pool.connect();

    try {
      // Fetch analyses details
      // We also try to fetch channel stats to get the rank if possible, 
      // but strictly speaking, rank calculation for many items might be complex.
      // For now, let's fetch the analysis data and channel data.
      
      const query = `
        WITH RankStats AS (
            SELECT 
                f_channel_id, 
                f_topic,
                RANK() OVER (PARTITION BY f_topic ORDER BY f_avg_reliability DESC) as channel_rank,
                COUNT(*) OVER (PARTITION BY f_topic) as total_channels
            FROM t_channel_stats
        )
        SELECT 
          a.f_id as id,
          a.f_title as title,
          a.f_topic as topic,
          a.f_reliability_score as score,
          a.f_created_at as created_at,
          c.f_name as channel_name,
          c.f_profile_image_url as channel_icon,
          COALESCE(rs.channel_rank, 0) as rank,
          COALESCE(rs.total_channels, 0) as total_rank
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_id
        LEFT JOIN RankStats rs ON a.f_channel_id = rs.f_channel_id AND a.f_topic = rs.f_topic
        WHERE a.f_id = ANY($1::uuid[]) 
           OR ($2::text IS NOT NULL AND a.f_user_id = $2::text)
        ORDER BY a.f_created_at DESC
      `;

      const res = await client.query(query, [safeIds, email || null]);
      
      const videos = res.rows.map(row => ({
        id: row.id,
        title: row.title,
        channel: row.channel_name || '알 수 없음',
        channelIcon: row.channel_icon,
        score: row.score,
        category: row.topic,
        fullDate: row.created_at, // 정렬용 정밀 타임스탬프 추가
        date: new Date(row.created_at).toLocaleDateString('ko-KR', {
           year: '2-digit',
           month: '2-digit',
           day: '2-digit'
        }).replace(/\./g, '').split(' ').join('.'), // Format: 25.01.15
        rank: row.rank > 0 ? row.rank : '-', 
        totalRank: row.total_rank > 0 ? row.total_rank : '-', 
        views: '-' // Not available in t_analyses
      }));

      return NextResponse.json({ videos });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching mypage videos:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
