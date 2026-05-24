import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET: 사용자의 알림 설정 조회 (스마트 알림 단일 상태)
 * Query: ?id=user_id
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
      // 1. 단일 스마트 알림 컬럼 추가 및 하위 호환용 데이터 보장
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_smart_notification BOOLEAN`);
      await client.query(`UPDATE t_users SET f_smart_notification = COALESCE(f_notify_grade_change, TRUE) WHERE f_smart_notification IS NULL`);
      await client.query(`ALTER TABLE t_users ALTER COLUMN f_smart_notification SET DEFAULT TRUE`);

      const result = await client.query(`
        SELECT
          COALESCE(f_smart_notification, TRUE) as f_smart_notification
        FROM t_users
        WHERE f_id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return NextResponse.json({
          f_smart_notification: true,
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
 * PUT: 스마트 알림 설정 변경
 * Body: { id, enabled }
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled boolean is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE t_users
        SET f_smart_notification = $1
        WHERE f_id = $2
        RETURNING f_smart_notification
      `, [enabled, id]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, f_smart_notification: result.rows[0].f_smart_notification });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update notification setting error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
