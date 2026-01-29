import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_recheck_credits INTEGER DEFAULT 0`)

      const res = await client.query(`SELECT COALESCE(f_recheck_credits, 0) as credits FROM t_users WHERE f_email = $1`, [email])

      const credits = res.rows.length > 0 ? Number(res.rows[0].credits) : 0
      return NextResponse.json({ credits })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Credits GET Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
