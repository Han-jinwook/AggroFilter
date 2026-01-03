import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // Find topics with more than 1 space (meaning 3+ words)
      // "AI 교육 자료" -> 2 spaces
      const res = await client.query(`
        SELECT id, name_ko 
        FROM t_topics_master 
        WHERE array_length(string_to_array(trim(name_ko), ' '), 1) > 2
      `);
      
      return NextResponse.json({ 
        count: res.rowCount,
        violations: res.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
