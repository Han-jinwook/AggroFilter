import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // 실제 랭킹 데이터가 존재하는 카테고리별 채널 수 가져오기
      const sql = `
        SELECT 
          f_official_category_id as category_id,
          COUNT(*) as channel_count
        FROM t_channel_stats
        GROUP BY f_official_category_id
        ORDER BY f_official_category_id ASC
      `;
      
      const res = await client.query(sql);
      const categories = res.rows.map(row => ({
        id: row.category_id,
        count: parseInt(row.channel_count)
      }));
      
      return NextResponse.json({ categories });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Topics API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
