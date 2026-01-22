import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('category');

  try {
    const client = await pool.connect();
    try {
      let sql = `
        SELECT 
          cs.f_channel_id as id,
          cs.f_official_category_id as category_id,
          cs.f_avg_reliability as score,
          c.f_name as name,
          c.f_profile_image_url as avatar
        FROM t_channel_stats cs
        JOIN t_channels c ON cs.f_channel_id = c.f_id
      `;

      const values: any[] = [];

      if (categoryId && categoryId !== 'all') {
        sql += ` WHERE cs.f_official_category_id = $1`;
        values.push(parseInt(categoryId));
      }

      sql += ` ORDER BY cs.f_avg_reliability DESC LIMIT 100`;

      const res = await client.query(sql, values);
      
      const rankedChannels = res.rows.map((row, index) => ({
        id: row.id,
        rank: index + 1,
        name: row.name,
        avatar: row.avatar,
        score: parseFloat(row.score),
        categoryId: row.category_id
      }));

      return NextResponse.json({ channels: rankedChannels });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ranking API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
