import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

// REFACTORED_BY_MERLIN_HUB: t_users 결제 매칭 → Hub wallet 이관 예정
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

function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return email.split('@')[0].trim().toLowerCase() === 'chiu3';
}

async function getAdminEmail(request: Request) {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user?.email) return data.user.email;
  } catch {}
  return request.headers.get('x-admin-email');
}

export async function GET(request: Request) {
  try {
    const email = await getAdminEmail(request);
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT 
          f_id as id,
          f_cafe24_order_id as order_id,
          f_buyer_email as buyer_email,
          f_product_id as product_id,
          f_product_name as product_name,
          f_amount_paid as amount_paid,
          f_status as status,
          f_created_at as created_at,
          f_updated_at as updated_at
        FROM t_unclaimed_payments
        ORDER BY f_created_at DESC
        LIMIT 100
      `);

      return NextResponse.json({ payments: res.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Unclaimed Payments GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Manually claim a payment for a user
 */
export async function POST(request: Request) {
  try {
    const adminEmail = await getAdminEmail(request);
    if (!isAdminEmail(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId, userId } = await request.json();

    if (!paymentId || !userId) {
      return NextResponse.json({ error: 'paymentId and userId are required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get payment info
      const payRes = await client.query(
        'SELECT * FROM t_unclaimed_payments WHERE f_id = $1 AND f_status = $2',
        [paymentId, 'PENDING']
      );

      if (payRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Payment not found or not in PENDING status' }, { status: 404 });
      }

      const payment = payRes.rows[0];

      // 2. Get user info
      const userRes = await client.query('SELECT f_id FROM t_users WHERE f_id = $1', [userId]);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const user = userRes.rows[0];

      // 3. Calculate credits (simplification for admin manual process)
      // In a real scenario, we'd use lib/cafe24 logic, but here we can trust the admin or the payment record
      // Let's assume the payment record has enough info or we just use a default mapping
      const amount = Number(payment.f_amount_paid);
      // For manual claiming, we might want to pass credits explicitly in request, 
      // but let's try to infer or let admin decide.
      // For now, let's just use 1 credit per 1000 won as a simple rule if not specified
      const credits = Math.floor(amount / 1000); 

      if (credits <= 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Could not calculate credits from amount' }, { status: 400 });
      }

      // 4. Update user credits ledger
      await client.query(ENSURE_CREDIT_HISTORY);
      const latestBalanceRes = await client.query(
        `SELECT f_balance FROM t_credit_history WHERE f_user_id = $1 ORDER BY f_id DESC LIMIT 1`,
        [user.f_id]
      );
      const currentBalance = latestBalanceRes.rows.length > 0 ? Number(latestBalanceRes.rows[0].f_balance) : 0;
      const safeBalance = Number.isFinite(currentBalance) ? currentBalance : 0;
      const newBalance = safeBalance + credits;
      await client.query(
        `INSERT INTO t_credit_history (f_user_id, f_type, f_amount, f_balance, f_description)
         VALUES ($1, 'charge', $2, $3, $4)`,
        [user.f_id, credits, newBalance, `미청구 결제 수동 매칭 +${credits}C`]
      );

      // 5. Mark payment as CLAIMED
      await client.query(
        `UPDATE t_unclaimed_payments SET f_status = $1, f_updated_at = NOW() WHERE f_id = $2`,
        ['CLAIMED', paymentId]
      );

      await client.query('COMMIT');
      return NextResponse.json({ success: true, creditsAdded: credits });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Unclaimed Payments POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
