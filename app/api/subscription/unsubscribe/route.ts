import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { channelIds } = body as { channelIds?: string[] };
    let { userId } = body as { userId?: string };

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return NextResponse.json({ error: 'Invalid channel IDs' }, { status: 400 });
    }

    if (!userId) {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      // 1. t_video_subscriptions에서 해당 채널 영상 구독 삭제
      try {
        await client.query(`
          DELETE FROM t_video_subscriptions
          WHERE f_channel_id = ANY($1::text[]) AND f_user_id = $2
        `, [channelIds, userId]);
      } catch {
      }

      // 2. t_channel_subscriptions에서 구독 삭제
      let subDeletedCount = 0;
      try {
        const subResult = await client.query(`
          DELETE FROM t_channel_subscriptions
          WHERE f_channel_id = ANY($1::text[]) AND f_user_id = $2
          RETURNING f_id
        `, [channelIds, userId]);
        subDeletedCount = subResult.rowCount || 0;
      } catch {
      }

      return NextResponse.json({ 
        success: true, 
        deletedSubscriptions: subDeletedCount,
        message: `${channelIds.length}개 채널이 관심 목록에서 삭제되었습니다.`
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Unsubscribe Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
