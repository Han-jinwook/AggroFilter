import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;

    if (!userId) {
      return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: false });
    }

    const client = await pool.connect();
    try {
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_credits INTEGER DEFAULT 0`);
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_ad_free_until TIMESTAMP WITH TIME ZONE DEFAULT NULL`);

      const res = await client.query(
        `SELECT COALESCE(f_credits, 0) as credits, f_ad_free_until
         FROM t_users WHERE f_id = $1`,
        [userId]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: true });
      }

      const row = res.rows[0];
      return NextResponse.json({
        credits: Number(row.credits) || 0,
        adFreeUntil: row.f_ad_free_until || null,
        loggedIn: true,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('GET /api/user/credits error:', error);
    return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: false }, { status: 500 });
  }
}
