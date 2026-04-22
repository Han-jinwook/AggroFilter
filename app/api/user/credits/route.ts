import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

// REFACTORED_BY_MERLIN_HUB: t_users 크레딧 조회 → Hub wallet 이관 예정
// AppHeader는 이미 Hub wallet SDK getBalance()로 전환됨
// 이 라우트는 하위 호환용으로 유지 (배너 광고 제거 등에서 참조)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';

    if (!userId) {
      return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: false });
    }

    // Hub 유저(mfn-)는 t_users에 없으므로 0 반환 — Hub wallet이 실제 잔액
    if (userId.startsWith('mfn-')) {
      return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: true });
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
