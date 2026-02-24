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
      const res = await client.query(`
        SELECT 
          a.f_id as id,
          a.f_title as title,
          a.f_reliability_score as score,
          a.f_accuracy_score as accuracy,
          a.f_clickbait_score as clickbait,
          a.f_created_at as created_at,
          a.f_is_recheck as is_recheck,
          a.f_language as language,
          a.f_grounding_used as grounding_used,
          a.f_grounding_queries as grounding_queries,
          u.f_email as user_email,
          u.f_id as user_id,
          COALESCE(NULLIF(c.f_title, ''), '알 수 없음') as channel_name
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
        LEFT JOIN t_users u ON a.f_user_id = u.f_id
        ORDER BY a.f_created_at DESC
        LIMIT 100
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

export async function DELETE(request: Request) {
  try {
    const email = await getAdminEmail(request);
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids 배열이 필요합니다' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(',');
      const res = await client.query(
        `DELETE FROM t_analyses WHERE f_id IN (${placeholders}) RETURNING f_id`,
        ids
      );
      return NextResponse.json({ deleted: res.rowCount });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Analysis Logs DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
