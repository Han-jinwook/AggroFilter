import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

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
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 't_payment_logs'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        return NextResponse.json({ logs: [] });
      }

      const res = await client.query(`
        SELECT 
          l.f_id as id,
          l.f_cafe24_order_id as order_id,
          l.f_user_id as user_id,
          u.f_email as user_email,
          l.f_buyer_email as buyer_email,
          l.f_amount_paid as amount_paid,
          l.f_credits_added as credits_added,
          l.f_status as status,
          l.f_created_at as created_at
        FROM t_payment_logs l
        LEFT JOIN t_users u ON l.f_user_id = u.f_id
        ORDER BY l.f_created_at DESC 
        LIMIT 50
      `);
      return NextResponse.json({ logs: res.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Payment Logs GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
