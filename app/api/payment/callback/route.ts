import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const amountParam = searchParams.get('amount')
    const userId = searchParams.get('userId')
    const redirectUrlParam = searchParams.get('redirectUrl')

    const redirectUrl = redirectUrlParam && redirectUrlParam.startsWith('/') ? redirectUrlParam : '/'

    if (status !== 'success' || !userId) {
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    const amount = Number(amountParam)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    const client = await pool.connect()
    try {
      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_recheck_credits INTEGER DEFAULT 0`)

      const updateRes = await client.query(
        `UPDATE t_users
         SET f_recheck_credits = COALESCE(f_recheck_credits, 0) + $1,
             f_updated_at = NOW()
         WHERE f_id = $2
         RETURNING f_recheck_credits`,
        [amount, userId]
      )

      if (updateRes.rows.length === 0) {
        console.error('Payment callback: User not found', userId)
      }


      return NextResponse.redirect(new URL(redirectUrl, request.url))
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Payment callback error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
