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
        ORDER BY DATE(f_created_at) ASC
      `);

      // 3. Score distribution (reliability buckets)
      const scoreDist = await client.query(`
        SELECT
          COUNT(CASE WHEN f_score >= 70 THEN 1 END) as green,
          COUNT(CASE WHEN f_score >= 40 AND f_score < 70 THEN 1 END) as yellow,
          COUNT(CASE WHEN f_score < 40 THEN 1 END) as red
        FROM t_analyses
        WHERE f_score IS NOT NULL
      `);

      // 4. Recheck vs new
      const recheckStats = await client.query(`
        SELECT
          COUNT(CASE WHEN f_is_recheck = true THEN 1 END) as recheck_count,
          COUNT(CASE WHEN f_is_recheck = false OR f_is_recheck IS NULL THEN 1 END) as new_count
        FROM t_analyses
      `);

      // 5. Language distribution
      const langStats = await client.query(`
        SELECT
          COALESCE(f_language, 'unknown') as language,
          COUNT(*) as count
        FROM t_analyses
        GROUP BY COALESCE(f_language, 'unknown')
        ORDER BY count DESC
        LIMIT 10
      `);

      return NextResponse.json({
        summary: totalStats.rows[0],
        daily: dailyStats.rows,
        scoreDist: scoreDist.rows[0],
        recheckStats: recheckStats.rows[0],
        langStats: langStats.rows,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Stats GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
