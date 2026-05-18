import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const { videoId, userId } = await request.json();
    if (!videoId || !userId) {
      return NextResponse.json({ error: 'videoId and userId are required' }, { status: 400, headers: corsHeaders });
    }

    console.log(`[Link Guest Analysis] Request to link videoId=${videoId} to userId=${userId}`);
    const client = await pool.connect();
    try {
      // f_video_id가 일치하고 f_user_id가 trial_ 로 시작하거나 NULL인 레코드를 신규 유저 ID로 업데이트
      const res = await client.query(`
        UPDATE t_analyses 
        SET f_user_id = $1 
        WHERE f_video_id = $2 AND (f_user_id LIKE 'trial_%' OR f_user_id IS NULL)
      `, [userId, videoId]);

      console.log(`[Link Guest Analysis] Successfully linked. Updated rows: ${res.rowCount}`);
      return NextResponse.json({ success: true, updatedCount: res.rowCount }, { headers: corsHeaders });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Link Guest Analysis] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
