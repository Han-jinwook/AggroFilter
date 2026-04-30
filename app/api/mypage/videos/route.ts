import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';
import { getCategoryName } from '@/lib/categoryMap';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { userId: userIdFromBody, familyUid: familyUidFromBody } = await request.json();

    let userId = (userIdFromBody || familyUidFromBody) as string | undefined;
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
      const refinedQuery = `
          WITH subscribed_videos AS (
            SELECT
              vs.f_video_id,
              vs.f_channel_id,
              vs.f_subscribed_at
            FROM t_video_subscriptions vs
            WHERE vs.f_user_id = $1
          ),
          subscription_rows AS (
            SELECT
              a.f_id,
              sv.f_video_id,
              a.f_title,
              a.f_reliability_score,
              COALESCE(sv.f_subscribed_at, a.f_created_at) as subscribed_at,
              COALESCE(a.f_channel_id, sv.f_channel_id) as f_channel_id,
              a.f_official_category_id
            FROM subscribed_videos sv
            JOIN LATERAL (
              SELECT
                a2.f_id,
                a2.f_title,
                a2.f_reliability_score,
                a2.f_created_at,
                a2.f_channel_id,
                a2.f_official_category_id
              FROM t_analyses a2
              WHERE a2.f_video_id = sv.f_video_id
              ORDER BY a2.f_created_at DESC
              LIMIT 1
            ) a ON true
          ),
          user_analysis_rows AS (
            SELECT DISTINCT ON (a.f_video_id)
              a.f_id,
              a.f_video_id,
              a.f_title,
              a.f_reliability_score,
              a.f_created_at as subscribed_at,
              a.f_channel_id,
              a.f_official_category_id
            FROM t_analyses a
            WHERE a.f_user_id = $1
            ORDER BY a.f_video_id, a.f_created_at DESC
          ),
          merged_rows AS (
            SELECT * FROM subscription_rows
            UNION ALL
            SELECT u.*
            FROM user_analysis_rows u
            WHERE NOT EXISTS (
              SELECT 1
              FROM subscription_rows s
              WHERE s.f_video_id = u.f_video_id
            )
          )
          SELECT
            m.f_id as id,
            m.f_title as title,
            m.f_reliability_score as score,
            m.subscribed_at,
            COALESCE(NULLIF(c.f_title, ''), '알 수 없음') as channel_name,
            COALESCE(NULLIF(c.f_thumbnail_url, ''), '/placeholder.svg') as channel_icon,
            m.f_official_category_id as category_id,
            m.f_channel_id as channel_id,
            COALESCE(NULLIF(c.f_language, ''), 'korean') as channel_language
          FROM merged_rows m
          LEFT JOIN t_channels c ON m.f_channel_id = c.f_channel_id
          ORDER BY m.subscribed_at DESC
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
