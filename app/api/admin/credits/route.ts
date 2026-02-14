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

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');

    if (!userEmail) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT f_id, f_email, f_nickname, COALESCE(f_recheck_credits, 0) as credits FROM t_users WHERE f_email = $1',
        [userEmail]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({ user: res.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Credits GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminEmail = await getAdminEmail(request);
    if (!isAdminEmail(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, amount, reason } = await request.json();

    if (!email || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [email]);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const updateRes = await client.query(
        `UPDATE t_users 
         SET f_recheck_credits = COALESCE(f_recheck_credits, 0) + $1,
             f_updated_at = NOW()
         WHERE f_email = $2
         RETURNING f_recheck_credits`,
        [amount, email]
      );

      // TODO: Log this admin action to a separate table if needed (t_admin_logs)

      await client.query('COMMIT');

      return NextResponse.json({ 
        success: true, 
        newCredits: updateRes.rows[0].f_recheck_credits 
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Credits POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
