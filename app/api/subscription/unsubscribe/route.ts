import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { channelIds } = await request.json();

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return NextResponse.json({ error: 'Invalid channel IDs' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // 채널 ID 배열을 기반으로 구독 삭제
      const result = await client.query(`
        DELETE FROM t_channel_subscriptions
        WHERE f_channel_id = ANY($1::text[])
        RETURNING f_id
      `, [channelIds]);

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
