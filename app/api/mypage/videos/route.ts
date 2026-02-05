import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ videos: [] });
    }

    const client = await pool.connect();

    try {
      // Query user's analyses directly from DB using email
      // No localStorage dependency - pure DB-based approach
      
      // [v2.2 Optimization] Use f_is_latest = true instead of CTE
      const refinedQuery = `
      WITH NormalizedChannels AS (
          SELECT 
              -- Join Key: Try f_channel_id first as it's usually the YouTube ID
              COALESCE(to_jsonb(c)->>'f_channel_id', to_jsonb(c)->>'f_id') as join_id,
              -- Display ID: For links/routing
              COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id') as display_id,
              -- Name: Try f_name then f_title
              COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title', '알 수 없는 채널') as display_name,
              -- Icon: Try f_profile_image_url then f_thumbnail_url
              COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url', '/placeholder.svg') as display_icon,
              c.f_official_category_id,
              COALESCE((to_jsonb(c)->>'f_trust_score')::int, (to_jsonb(c)->>'f_reliability_score')::int, 0) as f_trust_score
          FROM t_channels c
      ),
      RankStats AS (
          SELECT 
              join_id,
              f_official_category_id,
              RANK() OVER (PARTITION BY f_official_category_id ORDER BY f_trust_score DESC) as channel_rank,
              COUNT(*) OVER (PARTITION BY f_official_category_id) as total_channels
          FROM NormalizedChannels
      )
      SELECT 
        a.f_id as id,
        a.f_title as title,
        a.f_reliability_score as score,
        a.f_created_at as created_at,
        c.display_name as channel_name,
        c.display_icon as channel_icon,
        COALESCE(rs.channel_rank, 0) as rank,
        COALESCE(rs.total_channels, 0) as total_rank,
        COALESCE(to_jsonb(cat)->>'f_name_ko', to_jsonb(cat)->>'f_name', to_jsonb(cat)->>'f_title', '기타') as topic
      FROM t_analyses a
      LEFT JOIN NormalizedChannels c ON a.f_channel_id = c.join_id OR a.f_channel_id = c.display_id
      LEFT JOIN t_categories cat ON a.f_official_category_id = cat.f_id
      LEFT JOIN RankStats rs ON (a.f_channel_id = rs.join_id) AND a.f_official_category_id = rs.f_official_category_id
      WHERE a.f_user_id = $1
        AND a.f_is_latest = TRUE
      ORDER BY a.f_created_at DESC
    `;

    const res = await client.query(refinedQuery, [email]);
      
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
