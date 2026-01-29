import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const amountParam = searchParams.get('amount')
    const userId = searchParams.get('userId')
    const redirectUrlParam = searchParams.get('redirectUrl')

    const redirectUrl = redirectUrlParam && redirectUrlParam.startsWith('/') ? redirectUrlParam : '/'

    if (status !== 'success') {
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    if (!userId) {
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    const amount = Number(amountParam)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    const client = await pool.connect()
    try {
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_recheck_credits INTEGER DEFAULT 0`)

      const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [userId])
      if (userRes.rows.length === 0) {
        return NextResponse.redirect(new URL(redirectUrl, request.url))
      }

      await client.query(
        `UPDATE t_users
         SET f_recheck_credits = COALESCE(f_recheck_credits, 0) + $1,
             f_updated_at = NOW()
         WHERE f_email = $2`,
        [amount, userId]
      )

      return NextResponse.redirect(new URL(redirectUrl, request.url))
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Payment callback error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
