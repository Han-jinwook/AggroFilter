import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { channelId, userId, familyUid, limit } = body as { channelId?: string; userId?: string; familyUid?: string; limit?: number };
    const resolvedUserId = userId || familyUid;

    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }

    const n = Number(limit);
    const safeLimit = Number.isFinite(n) && n > 0 && n <= 20 ? Math.floor(n) : 5;

    const client = await pool.connect();
    try {
      // userId가 있으면 내 구독 영상만 + 내 구독일로 표시
      // userId가 없으면 기존 방식 (채널 최신 분석)
      const query = resolvedUserId
        ? `
          SELECT
            a.f_id as id,
            COALESCE(a.f_title, v.f_title, '제목 없음') as title,
            COALESCE(a.f_reliability_score, 0) as score,
            vs.f_subscribed_at as subscribed_at
          FROM t_video_subscriptions vs
          LEFT JOIN LATERAL (
            SELECT * FROM t_analyses a2
            WHERE a2.f_video_id = vs.f_video_id
            ORDER BY a2.f_created_at DESC
            LIMIT 1
          ) a ON true
          LEFT JOIN t_videos v ON v.f_video_id = vs.f_video_id
          WHERE vs.f_user_id = $3 AND vs.f_channel_id = $1
          ORDER BY vs.f_subscribed_at DESC
          LIMIT $2
        `
        : `
          SELECT
            a.f_id as id,
            a.f_title as title,
            a.f_reliability_score as score,
            a.f_created_at as subscribed_at
          FROM t_analyses a
          WHERE a.f_channel_id = $1
            AND a.f_is_latest = TRUE
            AND COALESCE(a.f_not_analyzable, FALSE) = FALSE
          ORDER BY a.f_created_at DESC
          LIMIT $2
        `;

      const params = resolvedUserId
        ? [channelId, safeLimit, resolvedUserId]
        : [channelId, safeLimit];

      const res = await client.query(query, params);

      const videos = res.rows.map((row) => ({
        id: row.id,
        title: row.title,
        score: Number(row.score) || 0,
        fullDate: row.subscribed_at,
        date: new Date(row.subscribed_at).toLocaleDateString('ko-KR', {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
        })
          .replace(/\./g, '')
          .split(' ')
          .join('.'),
      }));

      return NextResponse.json({ videos });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching channel videos:', error);
    return NextResponse.json({ error: 'Failed to fetch channel videos' }, { status: 500 });
  }
}
