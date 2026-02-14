import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET: 사용자의 구독 채널별 알림 설정 조회
 * Query: ?email=user@example.com
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const tableExistsRes = await client.query(
        `SELECT to_regclass('t_channel_subscriptions') IS NOT NULL AS exists`
      );
      if (!tableExistsRes.rows?.[0]?.exists) {
        return NextResponse.json({ subscriptions: [] });
      }

      const result = await client.query(`
        SELECT 
          s.f_channel_id,
          s.f_notification_enabled,
          c.f_title as channel_name,
          c.f_thumbnail_url
        FROM t_channel_subscriptions s
        JOIN t_channels c ON s.f_channel_id = c.f_channel_id
        WHERE s.f_user_id = $1
        ORDER BY s.f_subscribed_at DESC
      `, [email]);

      return NextResponse.json({ subscriptions: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get subscription notifications error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT: 특정 채널의 알림 토글 변경
 * Body: { email, channelId, enabled }
 */
export async function PUT(request: Request) {
  try {
    const { email, channelId, enabled } = await request.json();

    if (!email || !channelId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE t_channel_subscriptions
        SET f_notification_enabled = $1
        WHERE f_user_id = $2 AND f_channel_id = $3
        RETURNING f_notification_enabled
      `, [enabled, email, channelId]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }

      return NextResponse.json({ 
        success: true, 
        enabled: result.rows[0].f_notification_enabled 
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update subscription notification error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
