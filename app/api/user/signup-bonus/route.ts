import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

const BONUS_AMOUNT = 3000;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Supabase 서버 인증 → fallback
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

    const client = await pool.connect();
    try {
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_credits INTEGER DEFAULT 0`);
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_signup_bonus_given BOOLEAN DEFAULT FALSE`);

      // 이미 보너스를 받았는지 확인
      const checkRes = await client.query(
        'SELECT COALESCE(f_signup_bonus_given, false) as given FROM t_users WHERE f_id = $1',
        [userId]
      );

      if (checkRes.rows.length === 0) {
        return NextResponse.json({ bonus: 0, alreadyGiven: false, message: '사용자를 찾을 수 없습니다.' });
      }

      if (checkRes.rows[0].given === true) {
        // 이미 받은 유저 → 크레딧만 반환
        const balRes = await client.query('SELECT COALESCE(f_credits, 0) as credits FROM t_users WHERE f_id = $1', [userId]);
        return NextResponse.json({ bonus: 0, alreadyGiven: true, balance: Number(balRes.rows[0].credits) });
      }

      // 보너스 지급
      const res = await client.query(
        `UPDATE t_users
         SET f_credits = COALESCE(f_credits, 0) + $1,
             f_signup_bonus_given = TRUE,
             f_updated_at = NOW()
         WHERE f_id = $2
         RETURNING f_credits`,
        [BONUS_AMOUNT, userId]
      );

      const newBalance = Number(res.rows[0].f_credits);

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
         VALUES ($1, 'signup_bonus', $2, $3, $4)`,
        [userId, BONUS_AMOUNT, newBalance, `가입 보너스 +${BONUS_AMOUNT}C`]
      );

      console.log(`[Signup Bonus] userId=${userId}, +${BONUS_AMOUNT}C → balance=${newBalance}C`);

      return NextResponse.json({
        bonus: BONUS_AMOUNT,
        alreadyGiven: false,
        balance: newBalance,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('POST /api/user/signup-bonus error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
