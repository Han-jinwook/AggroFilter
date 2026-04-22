import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { createClient } from '@/utils/supabase/server'

// REFACTORED_BY_MERLIN_HUB: t_users 토스 결제 확인 → Hub wallet 이관 예정
export const runtime = 'nodejs'

// 크레딧 상품 정의 (금액 → 크레딧 매핑)
const CREDIT_PLANS: Record<number, number> = {
  1000: 1,    // 1,000원 → 1크레딧
  4500: 5,    // 4,500원 → 5크레딧 (10% 할인)
  8000: 10,   // 8,000원 → 10크레딧 (20% 할인)
}

export async function POST(request: Request) {
  try {
    const { paymentKey, orderId, amount } = await request.json()

    // 1. 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const numericAmount = Number(amount)

    // 2. 금액 → 크레딧 매핑 검증 (변조 방지)
    const credits = CREDIT_PLANS[numericAmount]
    if (!credits) {
      return NextResponse.json(
        { error: '유효하지 않은 결제 금액입니다.' },
        { status: 400 }
      )
    }

    // 3. 현재 로그인 사용자 확인
    let userId: string | null = null
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      userId = data?.user?.id || data?.user?.email || null
    } catch {}

    if (!userId) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 4. 토스 결제 승인 API 호출
    const secretKey = process.env.TOSS_SECRET_KEY
    if (!secretKey) {
      console.error('TOSS_SECRET_KEY is not set')
      return NextResponse.json(
        { error: '결제 설정 오류' },
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
        { error: confirmData.message || '결제 승인에 실패했습니다.' },
        { status: confirmRes.status }
      )
    }

    // 5. 크레딧 충전 + 결제 로그 저장
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 크레딧 충전
      const updateRes = await client.query(
        `UPDATE t_users
         SET f_recheck_credits = COALESCE(f_recheck_credits, 0) + $1,
             f_updated_at = NOW()
         WHERE f_id = $2
         RETURNING f_recheck_credits`,
        [credits, userId]
      )

      if (updateRes.rows.length === 0) {
        await client.query('ROLLBACK')
        console.error('Payment confirm: User not found', userId)
        return NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      // 결제 로그 저장
      await client.query(
        `CREATE TABLE IF NOT EXISTS t_toss_payments (
          f_id BIGSERIAL PRIMARY KEY,
          f_payment_key TEXT UNIQUE NOT NULL,
          f_order_id TEXT UNIQUE NOT NULL,
          f_user_id TEXT NOT NULL,
          f_amount INTEGER NOT NULL,
          f_credits INTEGER NOT NULL,
          f_status TEXT DEFAULT 'DONE',
          f_method TEXT,
          f_approved_at TIMESTAMP WITH TIME ZONE,
          f_raw JSONB,
          f_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`
      )

      await client.query(
        `INSERT INTO t_toss_payments (f_payment_key, f_order_id, f_user_id, f_amount, f_credits, f_status, f_method, f_approved_at, f_raw)
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

      const newCredits = updateRes.rows[0].f_recheck_credits

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
      { error: '결제 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
