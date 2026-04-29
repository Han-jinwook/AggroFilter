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
      // 1. t_video_subscriptions?êÏÑú ?¥Îãπ Ï±ÑÎÑê ?ÅÏÉÅ Íµ¨ÎèÖ ??†ú
      try {
        await client.query(`
          DELETE FROM t_video_subscriptions
          WHERE f_channel_id = ANY($1::text[]) AND f_user_id = $2
        `, [channelIds, userId]);
      } catch {
      }

      // 2. t_channel_subscriptions?êÏÑú Íµ¨ÎèÖ ??†ú
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
        message: `${channelIds.length}Í∞?Ï±ÑÎÑê??Í¥Ä??Î™©Î°ù?êÏÑú ??†ú?òÏóà?µÎãà??`
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Unsubscribe Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
