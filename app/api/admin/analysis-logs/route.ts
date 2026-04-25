import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

// REFACTORED_BY_MERLIN_HUB: t_users JOIN(분석 로그) → app_aggro_profiles 이관 예정
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
    const reviewOnly = searchParams.get('reviewOnly') === 'true';

    const client = await pool.connect();
    try {
      let query = `
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
          a.f_is_valid as is_valid,
          a.f_needs_review as needs_review,
          a.f_review_reason as review_reason,
          NULL::text as user_email,
          a.f_user_id as user_id,
          COALESCE(NULLIF(c.f_title, ''), '알 수 없음') as channel_name
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
      `;

      if (reviewOnly) {
        query += ` WHERE a.f_needs_review = TRUE `;
      }

      query += ` ORDER BY a.f_created_at DESC LIMIT 100 `;

      const res = await client.query(query);

      return NextResponse.json({ logs: res.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Analysis Logs GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const email = await getAdminEmail(request);
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, is_valid, needs_review } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        `UPDATE t_analyses 
         SET f_is_valid = COALESCE($1, f_is_valid),
             f_needs_review = COALESCE($2, f_needs_review),
             f_updated_at = NOW()
         WHERE f_id = $3
         RETURNING f_id`,
        [is_valid, needs_review, id]
      );

      if (res.rowCount === 0) {
        return NextResponse.json({ error: '해당 분석 기록을 찾을 수 없습니다' }, { status: 404 });
      }

      return NextResponse.json({ success: true, id: res.rows[0].f_id });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Analysis Logs PATCH Error:', error);
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
