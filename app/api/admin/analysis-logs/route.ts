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
      const res = await client.query(`
        SELECT 
          a.f_id as id,
          a.f_title as title,
          a.f_reliability_score as score,
          a.f_created_at as created_at,
          a.f_user_id as user_email,
          COALESCE(cat.f_name_ko, cat.f_name, '기타') as category_name,
          c.f_name as channel_name
        FROM t_analyses a
        LEFT JOIN t_categories cat ON a.f_official_category_id = cat.f_id
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_id
        ORDER BY a.f_created_at DESC
        LIMIT 50
      `);

      return NextResponse.json({ logs: res.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Analysis Logs GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
