import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { createClient } from '@/utils/supabase/server'

// REFACTORED_BY_MERLIN_HUB: t_users ?†Ïä§ Í≤∞Ï†ú ?ïÏù∏ ??Hub wallet ?¥Í? ?àÏ†ï
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

// ?¨Î†à???ÅÌíà ?ïÏùò (Í∏àÏï° ???¨Î†à??Îß§Ìïë)
const CREDIT_PLANS: Record<number, number> = {
  1000: 1,    // 1,000????1?¨Î†à??  4500: 5,    // 4,500????5?¨Î†à??(10% ?†Ïù∏)
  8000: 10,   // 8,000????10?¨Î†à??(20% ?†Ïù∏)
}

export async function POST(request: Request) {
  try {
    const { paymentKey, orderId, amount } = await request.json()

    // 1. ?ÑÏàò ?åÎùºÎØ∏ÌÑ∞ Í≤ÄÏ¶?    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: '?ÑÏàò ?åÎùºÎØ∏ÌÑ∞Í∞Ä ?ÑÎùΩ?òÏóà?µÎãà??' },
        { status: 400 }
      )
    }

    const numericAmount = Number(amount)

    // 2. Í∏àÏï° ???¨Î†à??Îß§Ìïë Í≤ÄÏ¶?(Î≥ÄÏ°?Î∞©Ï?)
    const credits = CREDIT_PLANS[numericAmount]
    if (!credits) {
      return NextResponse.json(
        { error: '?†Ìö®?òÏ? ?äÏ? Í≤∞Ï†ú Í∏àÏï°?ÖÎãà??' },
        { status: 400 }
      )
    }

    // 3. ?ÑÏû¨ Î°úÍ∑∏???¨Ïö©???ïÏù∏
    let userId: string | null = null
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      userId = data?.user?.id || data?.user?.email || null
    } catch {}

    if (!userId) {
      return NextResponse.json(
        { error: 'Î°úÍ∑∏?∏Ïù¥ ?ÑÏöî?©Îãà??' },
        { status: 401 }
      )
    }

    // 4. ?†Ïä§ Í≤∞Ï†ú ?πÏù∏ API ?∏Ï∂ú
    const secretKey = process.env.TOSS_SECRET_KEY
    if (!secretKey) {
      console.error('TOSS_SECRET_KEY is not set')
      return NextResponse.json(
        { error: 'Í≤∞Ï†ú ?§Ï†ï ?§Î•ò' },
        { status: 500 }
      )
    }

    const confirmRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount: numericAmount }),
    })

    const confirmData = await confirmRes.json()

    if (!confirmRes.ok) {
      console.error('Toss confirm failed:', confirmData)
      return NextResponse.json(
        { error: confirmData.message || 'Í≤∞Ï†ú ?πÏù∏???§Ìå®?àÏäµ?àÎã§.' },
        { status: confirmRes.status }
      )
    }

    // 5. ?¨Î†à???êÏû• ?ÅÏû¨ + Í≤∞Ï†ú Î°úÍ∑∏ ?Ä??    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(ENSURE_CREDIT_HISTORY)

      const latestRes = await client.query(
        `SELECT f_balance
         FROM t_credit_history
         WHERE f_user_id = $1
         ORDER BY f_id DESC
         LIMIT 1`,
        [userId]
      )
      const currentBalance = latestRes.rows.length > 0 ? Number(latestRes.rows[0].f_balance) : 0
      const safeBalance = Number.isFinite(currentBalance) ? currentBalance : 0
      const newCredits = safeBalance + credits

      await client.query(
        `INSERT INTO t_credit_history (f_user_id, f_type, f_amount, f_balance, f_description)
         VALUES ($1, 'charge', $2, $3, $4)`,
        [userId, credits, newCredits, `Toss Í≤∞Ï†ú Ï∂©Ï†Ñ +${credits}C (${numericAmount}??`]
      )

      // Í≤∞Ï†ú Î°úÍ∑∏ ?Ä??      await client.query(
        `CREATE TABLE IF NOT EXISTS t_toss_payments (
          f_id BIGSERIAL PRIMARY KEY,
          f_payment_key TEXT UNIQUE NOT NULL,
          f_order_id TEXT UNIQUE NOT NULL,
          f_user_id TEXT NOT NULL,
          f_amount INTEGER NOT NULL,
          f_credits_added INTEGER NOT NULL,
          f_status TEXT DEFAULT 'DONE',
          f_method TEXT,
          f_approved_at TIMESTAMP WITH TIME ZONE,
          f_raw JSONB,
          f_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`
      )

      await client.query(
        `ALTER TABLE t_toss_payments
         ADD COLUMN IF NOT EXISTS f_credits_added INTEGER`
      )

      await client.query(
        `INSERT INTO t_toss_payments (f_payment_key, f_order_id, f_user_id, f_amount, f_credits_added, f_status, f_method, f_approved_at, f_raw)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (f_payment_key) DO NOTHING`,
        [
          confirmData.paymentKey,
          confirmData.orderId,
          userId,
          numericAmount,
          credits,
          confirmData.status,
          confirmData.method,
          confirmData.approvedAt,
          JSON.stringify(confirmData),
        ]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        credits,
        totalCredits: newCredits,
        orderId: confirmData.orderId,
      })
    } catch (dbError) {
      await client.query('ROLLBACK')
      throw dbError
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Payment toss confirm error:', error)
    return NextResponse.json(
      { error: 'Í≤∞Ï†ú Ï≤òÎ¶¨ Ï§??§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.' },
      { status: 500 }
    )
  }
}
