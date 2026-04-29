import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';
import { getCategoryName } from '@/lib/categoryMap';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { userId: userIdFromBody, familyUid: familyUidFromBody } = await request.json();

    let userId = (userIdFromBody || familyUidFromBody) as string | undefined;
    console.log('[mypage/channels] userIdFromBody:', userIdFromBody);
    if (!userId) {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        console.log('[mypage/channels] supabase user:', data?.user?.id, data?.user?.email);
        if (data?.user?.id) userId = data.user.id;
      } catch (e) {
        console.error('[mypage/channels] supabase error:', e);
      }
    }
    console.log('[mypage/channels] resolved userId:', userId);

    if (!userId) {
      return NextResponse.json({ channels: [] });
    }

    const client = await pool.connect();
    try {
      const query = `
          WITH subscribed_channels AS (
            SELECT
              s.f_channel_id,
              s.f_subscribed_at
            FROM t_channel_subscriptions s
            WHERE s.f_user_id = $1
          ),
          subscription_rows AS (
            SELECT
              sc.f_channel_id,
              sc.f_subscribed_at as subscribed_at
            FROM subscribed_channels sc
          ),
          user_analysis_rows AS (
            SELECT DISTINCT ON (a.f_channel_id)
              a.f_channel_id,
              a.f_created_at as subscribed_at
            FROM t_analyses a
            WHERE a.f_user_id = $1
              AND a.f_channel_id IS NOT NULL
              AND a.f_channel_id <> ''
            ORDER BY a.f_channel_id, a.f_created_at DESC
          ),
          merged_rows AS (
            SELECT * FROM subscription_rows
            UNION ALL
            SELECT u.*
            FROM user_analysis_rows u
            WHERE NOT EXISTS (
              SELECT 1
              FROM subscription_rows s
              WHERE s.f_channel_id = u.f_channel_id
            )
          )
          SELECT
            m.f_channel_id as channel_id,
            m.subscribed_at,
            COALESCE(NULLIF(c.f_title, ''), '?????†ìŒ') as channel_name,
            COALESCE(cs.f_official_category_id, 0) as category_id,
            COALESCE(NULLIF(cs.f_language, ''), 'korean') as channel_language,
            COALESCE(cs.f_video_count, 0) as video_count,
            COALESCE(cs.f_avg_reliability, 0) as avg_reliability
          FROM merged_rows m
          LEFT JOIN t_channels c ON m.f_channel_id = c.f_channel_id
          LEFT JOIN t_channel_stats cs ON cs.f_channel_id = m.f_channel_id
          ORDER BY m.subscribed_at DESC NULLS LAST
        `;

      const res = await client.query(query, [userId]);

      const channels = res.rows.map((row) => {
        const subscribedAt = row.subscribed_at;
        const date = subscribedAt
          ? new Date(subscribedAt).toLocaleDateString('ko-KR', {
              year: '2-digit',
              month: '2-digit',
              day: '2-digit',
            })
              .replace(/\./g, '')
              .split(' ')
              .join('.')
          : '-';

        const categoryId = Number(row.category_id) || 0;
        const score = Number(row.avg_reliability);
        const rankScore = Number.isFinite(score) ? Math.round(score) : 0;
        const videoCount = Number(row.video_count) || 0;

        return {
          id: row.channel_id,
          channelId: row.channel_id,
          date,
          channelName: row.channel_name,
          topic: getCategoryName(categoryId) || 'ê¸°í?',
          categoryId,
          videoCount,
          rankScore,
          language: row.channel_language || 'korean',
        };
      });

      return NextResponse.json({ channels });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching mypage channels:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}
