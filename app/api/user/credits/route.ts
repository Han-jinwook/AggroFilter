import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

const ENSURE_CREDIT_HISTORY = `
  CREATE TABLE IF NOT EXISTS t_credit_history (
    f_id BIGSERIAL PRIMARY KEY,
    f_user_id TEXT NOT NULL,
    f_type TEXT NOT NULL,
    f_amount INTEGER NOT NULL,
    f_balance INTEGER NOT NULL,
    f_description TEXT,
    f_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )
`;

// REFACTORED_BY_MERLIN_HUB: t_users ?¨Î†à??Ï°∞Ìöå ??Hub wallet ?¥Í? ?àÏ†ï
// AppHeader???¥Î? Hub wallet SDK getBalance()Î°??ÑÌôò??// ???ºÏö∞?∏Îäî ?òÏúÑ ?∏Ìôò?©ÏúºÎ°??†Ï? (Î∞∞ÎÑà Í¥ëÍ≥† ?úÍ±∞ ?±Ïóê??Ï∞∏Ï°∞)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';

    if (!userId) {
      return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: false });
    }

    const client = await pool.connect();
    try {
      await client.query(ENSURE_CREDIT_HISTORY);

      const res = await client.query(
        `SELECT f_balance
         FROM t_credit_history
         WHERE f_user_id = $1
         ORDER BY f_id DESC
         LIMIT 1`,
        [userId]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: true });
      }

      const row = res.rows[0];
      return NextResponse.json({
        credits: Number(row.f_balance) || 0,
        adFreeUntil: null,
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
