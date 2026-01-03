import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT id, name_ko 
        FROM t_topics_master 
        WHERE name_ko ILIKE $1
        ORDER BY name_ko ASC
      `, [`%${query}%`]);
      
      return NextResponse.json({ 
        query,
        count: res.rowCount,
        results: res.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
