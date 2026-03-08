import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { analysisId, userId } = body as { analysisId?: string; userId?: string };

    if (!analysisId || typeof analysisId !== 'string') {
      return NextResponse.json({ error: 'analysisId is required' }, { status: 400 });
    }
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        `UPDATE t_analyses
         SET f_user_id = $2
         WHERE f_id = $1
           AND (f_user_id IS NULL OR f_user_id = '' OR f_user_id = 'anonymous')
         RETURNING f_id`,
        [analysisId, userId]
      );

      return NextResponse.json({ success: true, updated: (res.rowCount || 0) > 0 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[analysis/claim] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
