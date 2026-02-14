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
      // 1. Total Stats
      const totalStats = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM t_users) as total_users,
          (SELECT COUNT(*) FROM t_analyses) as total_analyses,
          (SELECT COUNT(*) FROM t_channels) as total_channels,
          (SELECT COUNT(DISTINCT f_user_id) FROM t_analyses WHERE f_user_id IS NOT NULL AND f_user_id != '') as unique_analysts
      `);

      // 2. Daily Stats (Last 30 days)
      const dailyStats = await client.query(`
        SELECT 
          DATE(f_created_at) as date,
          COUNT(*) as count
        FROM t_analyses
        WHERE f_created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(f_created_at)
        ORDER BY DATE(f_created_at) DESC
      `);

      return NextResponse.json({
        summary: totalStats.rows[0],
        daily: dailyStats.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Stats GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
