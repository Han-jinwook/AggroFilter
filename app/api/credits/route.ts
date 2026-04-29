import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { createClient } from '@/utils/supabase/server'

// REFACTORED_BY_MERLIN_HUB: t_users ?¬ë ˆ????Hub wallet ?´ê? ?ˆì •
export const runtime = 'nodejs'

const ENSURE_CREDIT_HISTORY = `
  CREATE TABLE IF NOT EXISTS t_credit_history (
    f_id BIGSERIAL PRIMARY KEY,
    f_user_id TEXT NOT NULL,
    f_type TEXT NOT NULL,
    f_amount INTEGER NOT NULL,
    f_balance INTEGER NOT NULL,
    f_description TEXT,
    f_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )
`

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id')

    if (!id) {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        if (data?.user?.id) id = data.user.id
      } catch {
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const client = await pool.connect()
    try {
      await client.query(ENSURE_CREDIT_HISTORY)

      const res = await client.query(
        `SELECT f_balance AS credits
         FROM t_credit_history
         WHERE f_user_id = $1
         ORDER BY f_id DESC
         LIMIT 1`,
        [id]
      )

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
