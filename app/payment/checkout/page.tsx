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
  { credits: 1, price: 1000, label: '🎫 [베이직] 33회 분석 이용권', desc: '1,000원' },
  { credits: 5, price: 4500, label: '💎 [프로] 166회 분석 이용권', desc: '4,500원 (10% 할인)' },
  { credits: 10, price: 9000, label: '👑 [프리미엄] 333회 분석 이용권', desc: '9,000원 (10% 할인)' },
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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'phone'>('card')
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
          <h1 className="text-xl font-black text-slate-900">어그로필터 분석 이용권 구매</h1>
          <p className="mt-2 text-sm text-slate-600">
            AI 신뢰도 분석에 사용할 이용권을 구매하세요.
          </p>

          {userId && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-xs text-slate-500">결제 계정: </span>
              <span className="text-sm font-bold text-slate-900">{userId}</span>
            </div>
          )}

          {/* 1. 이용권 상품 선택 */}
          <div className="mt-6 space-y-3">
            <h2 className="text-base font-black text-slate-900">1. 이용권 상품 선택</h2>
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
                  </div>
                  <span className="text-base font-black text-indigo-600">{plan.desc}</span>
                </div>
              </button>
            ))}
          </div>

          {/* 2. 결제 수단 선택 */}
          <div className="mt-6">
            <h2 className="text-base font-black text-slate-900 mb-4">2. 결제 수단 선택</h2>
            <div role="radiogroup" aria-label="결제 수단" className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 transition-all cursor-pointer ${
                  paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="text-lg">💳</span>
                <span className="font-bold">신용카드</span>
              </label>
              <label
                className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 transition-all cursor-pointer ${
                  paymentMethod === 'phone' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="phone"
                  checked={paymentMethod === 'phone'}
                  onChange={() => setPaymentMethod('phone')}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="text-lg">📱</span>
                <span className="font-bold">휴대폰 결제</span>
              </label>
            </div>
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

        {/* 상품 정보 및 정책 고지 */}
        <div className="mt-6 rounded-xl bg-slate-100 border border-slate-200 p-5 text-xs text-slate-500 space-y-3">
          <div>
            <p className="font-bold text-slate-700 mb-1">상품정보</p>
            <p>본 상품은 어그로필터 AI 신뢰도 분석을 이용할 수 있는 디지털 이용권입니다.</p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">배송/환불 정책</p>
            <p>결제 완료 시 계정으로 즉시 지급되는 무형의 디지털 재화이므로 실물 배송은 없습니다. 결제 후 7일 이내, 이용권을 단 1회도 사용하지 않은 경우에 한하여 고객센터를 통해 전액 환불 가능합니다. (일부 사용 시 잔여분 환불 불가)</p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">고객센터</p>
            <p>전화: 010-2597-7502 | 이메일: beakes@naver.com</p>
          </div>
        </div>
      </main>
    </div>
  )
}
