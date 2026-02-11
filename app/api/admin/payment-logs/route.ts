import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

async function isAdmin(email: string | null) {
  if (!email) return false;
  return email.split('@')[0].toLowerCase() === 'chiu3';
}

export async function GET() {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email ?? null;

    if (!await isAdmin(email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      // Note: This assumes we have a table or log for payments.
      // If t_payment_logs doesn't exist, we might need to check t_users credit update history
      // For now, let's try to query a hypothetical t_payment_logs or just returning an empty array if not exists
      
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 't_payment_logs'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        return NextResponse.json({ logs: [] });
      }

      const res = await client.query('SELECT * FROM t_payment_logs ORDER BY f_created_at DESC LIMIT 50');
      return NextResponse.json({ logs: res.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Payment Logs GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
