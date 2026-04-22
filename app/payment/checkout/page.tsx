'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/c-app-header'
import Script from 'next/script'

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      requestPayment: (method: string, options: Record<string, unknown>) => Promise<void>
    }
  }
}

const CREDIT_PLANS = [
  { credits: 1, price: 1000, label: '1크레딧', desc: '1,000원' },
  { credits: 5, price: 4500, label: '5크레딧', desc: '4,500원 (10% 할인)' },
  { credits: 10, price: 8000, label: '10크레딧', desc: '8,000원 (20% 할인)' },
]

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirectUrl') || '/'

  const [userId, setUserId] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        if (!isMounted) return
        const id = data?.user?.id || data?.user?.email || null
        if (id) {
          setUserId(id)
        } else {
          // Supabase 서버 인증 실패 시 localStorage fallback
          // REFACTORED_BY_MERLIN_HUB: userId → merlin_family_uid
          const fallbackId = localStorage.getItem('merlin_family_uid') || localStorage.getItem('userEmail') || null
          setUserId(fallbackId)
        }
      })
      .catch(() => {
        const fallbackId = localStorage.getItem('merlin_family_uid') || localStorage.getItem('userEmail') || null
        if (isMounted) setUserId(fallbackId)
      })
    return () => { isMounted = false }
  }, [])

  const handlePayment = useCallback(async () => {
    if (selectedPlan === null) return
    if (!userId) {
      setError('로그인이 필요합니다.')
      return
    }
    if (!sdkReady || !window.TossPayments) {
      setError('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    const plan = CREDIT_PLANS[selectedPlan]
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
    if (!clientKey) {
      setError('결제 설정 오류')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const orderId = `agf_${userId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const tossPayments = window.TossPayments(clientKey)

      await tossPayments.requestPayment('카드', {
        amount: plan.price,
        orderId,
        orderName: `어그로필터 ${plan.label}`,
        successUrl: `${window.location.origin}/payment/success?redirectUrl=${encodeURIComponent(redirectUrl)}`,
        failUrl: `${window.location.origin}/payment/fail?redirectUrl=${encodeURIComponent(redirectUrl)}`,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '결제가 취소되었습니다.'
      if (!message.includes('USER_CANCEL')) {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedPlan, userId, sdkReady, redirectUrl])

  return (
    <div className="min-h-screen bg-slate-50">
      <Script
        src="https://js.tosspayments.com/v1/payment"
        onLoad={() => setSdkReady(true)}
        strategy="afterInteractive"
      />
      <AppHeader />
      <main className="mx-auto max-w-[var(--app-max-width)] px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black text-slate-900">크레딧 충전</h1>
          <p className="mt-2 text-sm text-slate-600">
            재분석에 사용할 크레딧을 충전하세요.
          </p>

          {userId && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-xs text-slate-500">결제 계정: </span>
              <span className="text-sm font-bold text-slate-900">{userId}</span>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {CREDIT_PLANS.map((plan, idx) => (
              <button
                key={plan.credits}
                onClick={() => setSelectedPlan(idx)}
                className={
                  'w-full rounded-xl px-5 py-4 text-left border-2 transition-all ' +
                  (selectedPlan === idx
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-slate-300')
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-base font-black text-slate-900">{plan.label}</span>
                    {plan.credits > 1 && (
                      <span className="ml-2 text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                        할인
                      </span>
                    )}
                  </div>
                  <span className="text-base font-black text-slate-900">{plan.desc}</span>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handlePayment}
            disabled={selectedPlan === null || loading || !userId}
            className={
              'mt-6 w-full rounded-xl px-4 py-3.5 text-sm font-black transition-colors ' +
              (selectedPlan !== null && !loading && userId
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed')
            }
          >
            {loading ? '결제 진행 중...' : !userId ? '로그인 필요' : '결제하기'}
          </button>

          <button
            onClick={() => router.push(redirectUrl)}
            className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            취소하고 돌아가기
          </button>
        </div>
      </main>
    </div>
  )
}
