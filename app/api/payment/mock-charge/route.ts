import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const credits = Number(body.credits);

    if (!Number.isFinite(credits) || credits <= 0 || credits > 100) {
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
