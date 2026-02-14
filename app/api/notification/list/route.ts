import { NextResponse } from 'next/server'

import { pool } from '@/lib/db'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const emailFromQuery = searchParams.get('email')
    let email = emailFromQuery
    if (!email) {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        email = data?.user?.email ?? null
      } catch {}
    }
    if (!email) return NextResponse.json({ notifications: [] })

    const client = await pool.connect()
    try {
      const res = await client.query(
        `SELECT f_id as id, f_type as type, f_message as message, f_link as link, f_is_read as is_read, f_created_at as created_at
         FROM t_notifications
         WHERE f_user_id = $1
         ORDER BY f_created_at DESC
         LIMIT 100`,
        [email]
      )
      return NextResponse.json({ notifications: res.rows })
    } finally {
      client.release()
    }
  } catch (e) {
    console.error('[notification/list] error:', e)
    return NextResponse.json({ notifications: [] })
  }
}

// 읽음 처리
export async function POST(request: Request) {
  try {
    const { email, ids } = await request.json()
    if (!email || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      const placeholders = ids.map((_: any, i: number) => `$${i + 2}`).join(',')
      await client.query(
        `UPDATE t_notifications SET f_is_read = TRUE WHERE f_user_id = $1 AND f_id IN (${placeholders})`,
        [email, ...ids]
      )
      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (e) {
    console.error('[notification/mark-read] error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
