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
      // t_video_subscriptions 기반 — 내 구독일(f_subscribed_at)을 표시 날짜로 사용
      // 구독 삭제 시 해당 채널 영상 전부 자동 소멸
      const refinedQuery = `
        SELECT
          a.f_id as id,
          a.f_title as title,
          a.f_reliability_score as score,
          vs.f_subscribed_at as subscribed_at,
          COALESCE(NULLIF(c.f_title, ''), '알 수 없음') as channel_name,
          COALESCE(NULLIF(c.f_thumbnail_url, ''), '/placeholder.svg') as channel_icon,
          a.f_official_category_id as category_id,
          vs.f_channel_id as channel_id,
          c.f_language as channel_language
        FROM t_video_subscriptions vs
        JOIN LATERAL (
          SELECT *
          FROM t_analyses a2
          WHERE a2.f_video_id = vs.f_video_id
          ORDER BY a2.f_created_at DESC
          LIMIT 1
        ) a ON true
        LEFT JOIN t_channels c ON vs.f_channel_id = c.f_channel_id
        WHERE vs.f_user_id = $1
        ORDER BY vs.f_subscribed_at DESC
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
