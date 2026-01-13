import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { analysisId } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query(`
        UPDATE t_analyses 
        SET f_view_count = COALESCE(f_view_count, 0) + 1,
            f_last_action_at = NOW()
        WHERE f_id = $1
      `, [analysisId]);

      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('View Count API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
