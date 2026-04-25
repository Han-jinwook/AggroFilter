import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

// REFACTORED_BY_MERLIN_HUB: t_users 크레딧 충전 → Hub wallet 이관 예정
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const credits = Number(body.credits);

    // Supabase 서버 인증 → 실패 시 body.userId fallback
    let userId: string | undefined;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) userId = data.user.id;
    } catch {}

    if (!userId && typeof body.userId === 'string' && body.userId.length > 0) {
      userId = body.userId;
    }

    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!Number.isFinite(credits) || credits <= 0 || credits > 10000) {
      return NextResponse.json({ error: '유효하지 않은 크레딧 수량입니다.' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(ENSURE_CREDIT_HISTORY);

      const latestRes = await client.query(
        `SELECT f_balance
         FROM t_credit_history
         WHERE f_user_id = $1
         ORDER BY f_id DESC
         LIMIT 1`,
        [userId]
      );

      const currentBalance = latestRes.rows.length > 0 ? Number(latestRes.rows[0].f_balance) : 0;
      const safeBalance = Number.isFinite(currentBalance) ? currentBalance : 0;
      const newBalance = safeBalance + credits;
      console.log(`[Mock Charge] userId=${userId}, +${credits}C → balance=${newBalance}C`);

      await client.query(
        `INSERT INTO t_credit_history (f_user_id, f_type, f_amount, f_balance, f_description)
         VALUES ($1, 'charge', $2, $3, $4)`,
        [userId, credits, newBalance, `Mock 충전 +${credits}C`]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        charged: credits,
        balance: newBalance,
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('POST /api/payment/mock-charge error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
