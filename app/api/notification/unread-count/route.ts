import { NextResponse } from 'next/server'

import { pool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) return NextResponse.json({ unreadCount: 0 })

    const client = await pool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS t_notifications (
          f_id BIGSERIAL PRIMARY KEY,
          f_user_id TEXT NOT NULL,
          f_type TEXT NOT NULL,
          f_message TEXT NOT NULL,
          f_link TEXT,
          f_is_read BOOLEAN DEFAULT FALSE,
          f_created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `)
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON t_notifications (f_user_id, f_is_read);`
      )

      const res = await client.query(
        `SELECT COUNT(*)::int AS unread_count
         FROM t_notifications
         WHERE f_user_id = $1 AND f_is_read = FALSE`,
        [email]
      )

      return NextResponse.json({ unreadCount: res.rows?.[0]?.unread_count ?? 0 })
    } finally {
      client.release()
    }
  } catch (e) {
    console.error('[notification/unread-count] error:', e)
    return NextResponse.json({ unreadCount: 0 })
  }
}
