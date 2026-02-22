import { NextResponse } from 'next/server'

import { pool } from '@/lib/db'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      const res = await client.query(
        `SELECT f_id as id, f_type as type, f_message as message, f_link as link, f_is_read as is_read, f_created_at as created_at
         FROM t_notifications
         WHERE f_user_id = $1
         ORDER BY f_created_at DESC
         LIMIT 100`,
        [userId]
      )
      return NextResponse.json({ notifications: res.rows })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Notifications GET Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { userId, ids } = await request.json()

    if (!userId || !ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      const placeholders = ids.map((_: any, i: number) => `$${i + 2}`).join(',')
      await client.query(
        `UPDATE t_notifications SET f_is_read = TRUE WHERE f_user_id = $1 AND f_id IN (${placeholders})`,
        [userId, ...ids]
      )
      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Notifications PUT Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
