import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

// REFACTORED_BY_MERLIN_HUB: t_users 크레딧 충전 → Hub wallet 이관 예정
export const runtime = 'nodejs';

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
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_credits INTEGER DEFAULT 0`);

      const res = await client.query(
        `UPDATE t_users
         SET f_credits = COALESCE(f_credits, 0) + $1,
             f_updated_at = NOW()
         WHERE f_id = $2
         RETURNING f_credits`,
        [credits, userId]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      const newBalance = Number(res.rows[0].f_credits);
      console.log(`[Mock Charge] userId=${userId}, +${credits}C → balance=${newBalance}C`);

      // 이력 기록
      await client.query(`
        CREATE TABLE IF NOT EXISTS t_credit_history (
          f_id BIGSERIAL PRIMARY KEY,
          f_user_id TEXT NOT NULL,
          f_type TEXT NOT NULL,
          f_amount INTEGER NOT NULL,
          f_balance INTEGER NOT NULL,
          f_description TEXT,
          f_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await client.query(
        `INSERT INTO t_credit_history (f_user_id, f_type, f_amount, f_balance, f_description)
         VALUES ($1, 'charge', $2, $3, $4)`,
        [userId, credits, newBalance, `Mock 충전 +${credits}C`]
      );

      return NextResponse.json({
        success: true,
        charged: credits,
        balance: newBalance,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('POST /api/payment/mock-charge error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
