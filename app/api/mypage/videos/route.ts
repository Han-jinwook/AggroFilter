import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';
import { getCategoryName } from '@/lib/categoryMap';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { userId: userIdFromBody } = await request.json();

    let userId = userIdFromBody as string | undefined;
    console.log('[mypage/videos] userIdFromBody:', userIdFromBody);
    if (!userId) {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        console.log('[mypage/videos] supabase user:', data?.user?.id, data?.user?.email);
        if (data?.user?.id) userId = data.user.id;
      } catch (e) {
        console.error('[mypage/videos] supabase error:', e);
      }
    }
    console.log('[mypage/videos] resolved userId:', userId);

    if (!userId) {
      return NextResponse.json({ videos: [] });
    }

    const client = await pool.connect();

    try {
      const tableExistsRes = await client.query(
        `SELECT to_regclass('t_video_subscriptions') IS NOT NULL AS exists`
      );
      const tableExists = tableExistsRes.rows?.[0]?.exists === true;

      const refinedQuery = tableExists
        ? `
          WITH latest_user_analyses AS (
            SELECT DISTINCT ON (a.f_video_id)
              a.f_id,
              a.f_video_id,
              a.f_title,
              a.f_reliability_score,
              a.f_created_at,
              a.f_channel_id,
              a.f_official_category_id
            FROM t_analyses a
            WHERE a.f_user_id = $1
            ORDER BY a.f_video_id, a.f_created_at DESC
          )
          SELECT
            lua.f_id as id,
            lua.f_title as title,
            lua.f_reliability_score as score,
            COALESCE(vs.f_subscribed_at, lua.f_created_at) as subscribed_at,
            COALESCE(NULLIF(c.f_title, ''), '알 수 없음') as channel_name,
            COALESCE(NULLIF(c.f_thumbnail_url, ''), '/placeholder.svg') as channel_icon,
            lua.f_official_category_id as category_id,
            lua.f_channel_id as channel_id,
            COALESCE(NULLIF(c.f_language, ''), 'korean') as channel_language
          FROM latest_user_analyses lua
          LEFT JOIN t_video_subscriptions vs
            ON vs.f_user_id = $1 AND vs.f_video_id = lua.f_video_id
          LEFT JOIN t_channels c ON lua.f_channel_id = c.f_channel_id
          ORDER BY COALESCE(vs.f_subscribed_at, lua.f_created_at) DESC
          LIMIT 200
        `
        : `
          WITH latest_user_analyses AS (
            SELECT DISTINCT ON (a.f_video_id)
              a.f_id,
              a.f_video_id,
              a.f_title,
              a.f_reliability_score,
              a.f_created_at,
              a.f_channel_id,
              a.f_official_category_id
            FROM t_analyses a
            WHERE a.f_user_id = $1
            ORDER BY a.f_video_id, a.f_created_at DESC
          )
          SELECT
            lua.f_id as id,
            lua.f_title as title,
            lua.f_reliability_score as score,
            lua.f_created_at as subscribed_at,
            COALESCE(NULLIF(c.f_title, ''), '알 수 없음') as channel_name,
            COALESCE(NULLIF(c.f_thumbnail_url, ''), '/placeholder.svg') as channel_icon,
            lua.f_official_category_id as category_id,
            lua.f_channel_id as channel_id,
            COALESCE(NULLIF(c.f_language, ''), 'korean') as channel_language
          FROM latest_user_analyses lua
          LEFT JOIN t_channels c ON lua.f_channel_id = c.f_channel_id
          ORDER BY lua.f_created_at DESC
          LIMIT 200
        `;

      const res = await client.query(refinedQuery, [userId]);
      
      const videos = res.rows.map(row => ({
        id: row.id,
        title: row.title,
        channel: row.channel_name || '알 수 없음',
        channelId: row.channel_id,
        channelIcon: row.channel_icon,
        channelLanguage: row.channel_language || 'korean',
        score: row.score,
        category: getCategoryName(row.category_id),
        categoryId: row.category_id,
        fullDate: row.subscribed_at, // 내 구독일 (정렬용 정밀 타임스탬프)
        date: new Date(row.subscribed_at).toLocaleDateString('ko-KR', {
           year: '2-digit',
           month: '2-digit',
           day: '2-digit'
        }).replace(/\./g, '').split(' ').join('.'), // Format: 25.01.15
        rank: '-', 
        totalRank: '-', 
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
