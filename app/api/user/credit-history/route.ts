import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

const ENSURE_TABLE = `
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

export async function GET(request: Request) {
  try {
    let userId: string | undefined;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) userId = data.user.id;
    } catch {}

    if (!userId) {
      const { searchParams } = new URL(request.url);
      const fallback = searchParams.get('userId');
      if (fallback && typeof fallback === 'string' && fallback.length > 0) {
        userId = fallback;
      }
    }

    if (!userId) {
      return NextResponse.json({ history: [], loggedIn: false });
    }

    const client = await pool.connect();
    try {
      await client.query(ENSURE_TABLE);

      const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1);
      const limit = 20;
      const offset = (page - 1) * limit;

      const countRes = await client.query(
        'SELECT COUNT(*) as total FROM t_credit_history WHERE f_user_id = $1',
        [userId]
      );
      const total = Number(countRes.rows[0].total);

      const res = await client.query(
        `SELECT f_id, f_type, f_amount, f_balance, f_description, f_created_at
         FROM t_credit_history
         WHERE f_user_id = $1
         ORDER BY f_created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return NextResponse.json({
        history: res.rows.map(r => ({
          id: r.f_id,
          type: r.f_type,
          amount: r.f_amount,
          balance: r.f_balance,
          description: r.f_description,
          createdAt: r.f_created_at,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
        loggedIn: true,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Credit history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
