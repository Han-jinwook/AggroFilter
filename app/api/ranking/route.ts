import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');

  try {
    const client = await pool.connect();
    try {
      let query = `
        SELECT 
          cs.f_channel_id,
          cs.f_topic,
          cs.f_avg_reliability as "reliabilityScore",
          cs.f_avg_accuracy as "accuracyScore",
          cs.f_avg_clickbait as "clickbaitScore",
          c.f_name as "channelName",
          c.f_profile_image_url as "channelImage"
        FROM t_channel_stats cs
        JOIN t_channels c ON cs.f_channel_id = c.f_id
      `;

      const values: any[] = [];

      if (topic) {
        query += ` WHERE cs.f_topic ILIKE $1`;
        values.push(`%${topic}%`);
      }

      query += ` ORDER BY cs.f_avg_reliability DESC LIMIT 50`;

      const res = await client.query(query, values);
      
      // Add rank to the results
      const rankedResults = res.rows.map((row, index) => ({
        ...row,
        rank: index + 1
      }));

      return NextResponse.json(rankedResults);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ranking API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
