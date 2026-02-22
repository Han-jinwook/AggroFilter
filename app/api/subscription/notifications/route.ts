import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

const VALID_KEYS = ['f_notify_grade_change', 'f_notify_ranking_change', 'f_notify_top10_change'] as const;

/**
 * GET: 사용자의 알림 설정 조회 (3개 조건별 ON/OFF)
 * Query: ?email=user@example.com
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_notify_grade_change BOOLEAN DEFAULT TRUE`);
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_notify_ranking_change BOOLEAN DEFAULT TRUE`);
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_notify_top10_change BOOLEAN DEFAULT TRUE`);

      const result = await client.query(`
        SELECT
          COALESCE(f_notify_grade_change, TRUE) as f_notify_grade_change,
          COALESCE(f_notify_ranking_change, TRUE) as f_notify_ranking_change,
          COALESCE(f_notify_top10_change, TRUE) as f_notify_top10_change
        FROM t_users
        WHERE f_id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return NextResponse.json({
          f_notify_grade_change: true,
          f_notify_ranking_change: true,
          f_notify_top10_change: true,
        });
      }

      return NextResponse.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get notification settings error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT: 알림 조건별 토글 변경
 * Body: { email, key, enabled }
 * key: 'f_notify_grade_change' | 'f_notify_ranking_change' | 'f_notify_top10_change'
 */
export async function PUT(request: Request) {
  try {
    const { id, key, enabled } = await request.json();

    if (!id || !key || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!VALID_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE t_users
        SET ${key} = $1
        WHERE f_id = $2
        RETURNING ${key}
      `, [enabled, id]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, [key]: result.rows[0][key] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update notification setting error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
