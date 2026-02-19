import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'korean';

  try {
    const client = await pool.connect();
    try {
      // 언어별 카테고리 목록 가져오기 (t_rankings_cache 기반)
      const sql = `
        SELECT 
          f_category_id as category_id,
          COUNT(DISTINCT f_channel_id) as channel_count
        FROM t_rankings_cache
        WHERE f_language = $1
        GROUP BY f_category_id
        ORDER BY f_category_id ASC
      `;
      
      const res = await client.query(sql, [lang]);
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
