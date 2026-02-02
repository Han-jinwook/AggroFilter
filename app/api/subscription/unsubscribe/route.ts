import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { channelIds, email } = await request.json();

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return NextResponse.json({ error: 'Invalid channel IDs' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'User email is required' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [email]);

      if (userRes.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const userId = userRes.rows[0].f_id;

      // 채널 ID 배열과 사용자 ID를 기반으로 구독 삭제
      const result = await client.query(`
        DELETE FROM t_channel_subscriptions
        WHERE f_channel_id = ANY($1::text[]) AND f_user_id = $2
        RETURNING f_id
      `, [channelIds, userId]);

      return NextResponse.json({ 
        success: true, 
        deletedCount: result.rowCount,
        message: `${result.rowCount}개 채널 구독이 해제되었습니다.`
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Unsubscribe Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
