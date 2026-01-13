import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryParam = searchParams.get('query');

  try {
    const client = await pool.connect();
    try {
      let sql = `
        SELECT 
          cs.f_channel_id as id,
          cs.f_topic as topic,
          cs.f_avg_reliability as score,
          c.f_name as name,
          c.f_profile_image_url as avatar
        FROM t_channel_stats cs
        JOIN t_channels c ON cs.f_channel_id = c.f_id
      `;

      const values: any[] = [];

      if (queryParam) {
        sql += ` WHERE cs.f_topic ILIKE $1`;
        values.push(`%${queryParam}%`);
      }

      sql += ` ORDER BY cs.f_avg_reliability DESC LIMIT 100`;

      const res = await client.query(sql, values);
      
      // Add rank to the results and format for frontend
      const rankedChannels = res.rows.map((row, index) => ({
        id: row.id,
        rank: index + 1,
        name: row.name,
        avatar: row.avatar,
        score: parseFloat(row.score), // numeric 타입은 string으로 반환될 수 있으므로 변환
        topic: row.topic
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
