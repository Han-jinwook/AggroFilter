import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // 실제 랭킹 데이터가 존재하는 주제들만 가져오기 위해 t_channel_stats 사용
      const sql = `
        SELECT DISTINCT f_topic as topic
        FROM t_channel_stats
        ORDER BY f_topic ASC
        LIMIT 50
      `;
      
      const res = await client.query(sql);
      // 프론트엔드에서 '#'을 붙여서 보여주므로 여기서는 순수 텍스트만 반환
      const topics = res.rows.map(row => row.topic);
      
      return NextResponse.json({ topics });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Topics API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
