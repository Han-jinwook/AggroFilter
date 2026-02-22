import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { channelIds, userId } = await request.json();

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return NextResponse.json({ error: 'Invalid channel IDs' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      // 1. t_channel_subscriptions에서 구독 삭제
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

      // 2. t_analyses에서 해당 유저의 해당 채널 분석 기록 삭제
      const analysisResult = await client.query(`
        DELETE FROM t_analyses
        WHERE f_channel_id = ANY($1::text[]) AND f_user_id = $2
        RETURNING f_id
      `, [channelIds, userId]);
      const analysisDeletedCount = analysisResult.rowCount || 0;


      return NextResponse.json({ 
        success: true, 
        deletedSubscriptions: subDeletedCount,
        deletedAnalyses: analysisDeletedCount,
        message: `${channelIds.length}개 채널의 구독 및 분석 기록(${analysisDeletedCount}건)이 삭제되었습니다.`
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Unsubscribe Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
