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
      // 1. Total Stats
      const totalStats = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM t_users) as total_users,
          (SELECT COUNT(*) FROM t_analyses) as total_analyses,
          (SELECT COUNT(*) FROM t_channels) as total_channels
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
