import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { analysisId, userId } = body as { analysisId?: string; userId?: string };

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId is required' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const tableExistsRes = await client.query(
        `SELECT to_regclass('t_channel_subscriptions') IS NOT NULL AS exists`
      );
      const tableExists = tableExistsRes.rows?.[0]?.exists === true;
      if (!tableExists) {
        return NextResponse.json({ success: true, skipped: true, reason: 't_channel_subscriptions not found' });
      }

      // t_video_subscriptions 테이블 보장
      await client.query(`
        CREATE TABLE IF NOT EXISTS t_video_subscriptions (
          f_id BIGSERIAL PRIMARY KEY,
          f_user_id TEXT NOT NULL,
          f_video_id TEXT NOT NULL,
          f_channel_id TEXT NOT NULL,
          f_subscribed_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(f_user_id, f_video_id)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_video_subs_user ON t_video_subscriptions(f_user_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_video_subs_channel ON t_video_subscriptions(f_user_id, f_channel_id)`);

      const analysisRes = await client.query(
        `SELECT f_channel_id, f_video_id
         FROM t_analyses
         WHERE f_id = $1
         LIMIT 1`,
        [analysisId]
      );

      if (analysisRes.rows.length === 0) {
        return NextResponse.json({ success: true, skipped: true, reason: 'analysis not found' });
      }

      const channelId = (analysisRes.rows?.[0]?.f_channel_id || '').trim();
      const videoId = (analysisRes.rows?.[0]?.f_video_id || '').trim();
      if (!channelId) {
        return NextResponse.json({ success: true, skipped: true, reason: 'channelId not found' });
      }

      // 채널 구독 upsert
      const existing = await client.query(
        `SELECT f_id, f_subscribed_at
         FROM t_channel_subscriptions
         WHERE f_user_id = $1 AND f_channel_id = $2
         LIMIT 1`,
        [userId, channelId]
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO t_channel_subscriptions (f_user_id, f_channel_id, f_subscribed_at)
           VALUES ($1, $2, NOW())`,
          [userId, channelId]
        );
      } else {
        const subscribedAt = existing.rows[0]?.f_subscribed_at;
        if (!subscribedAt) {
          await client.query(
            `UPDATE t_channel_subscriptions
             SET f_subscribed_at = NOW()
             WHERE f_id = $1`,
            [existing.rows[0].f_id]
          );
        }
      }

      // 영상 구독 upsert (내 구독일 = NOW())
      if (videoId) {
        await client.query(
          `INSERT INTO t_video_subscriptions (f_user_id, f_video_id, f_channel_id, f_subscribed_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (f_user_id, f_video_id) DO NOTHING`,
          [userId, videoId, channelId]
        );
      }

      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[subscription/track] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
