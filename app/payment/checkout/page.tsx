'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Script from 'next/script'

// KCP payplus_web.jsp 전역 함수 타입 선언
declare global {
  interface Window {
    js_f_pay: (formId: string) => void
    // KCP 콜백 결과 수신 함수 (일부 환경에서 호출됨)
    kcpCallback?: (res: Record<string, string>) => void
  }
}

const CREDIT_PLANS = [
  { coins: 100,  price: 1000,  label: '🎫 [베이직] 100코인',   desc: '1,000원' },
  { coins: 500,  price: 4500,  label: '💎 [프로] 500코인',     desc: '4,500원 (10% 할인)' },
  { coins: 1100, price: 9000,  label: '👑 [프리미엄] 1100코인', desc: '9,000원 (10% 할인)' },
]

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl') || searchParams.get('redirectUrl') || 'https://aggrofilter.com'

  const [userId, setUserId]           = useState<string | null>(null)
  const [authToken, setAuthToken]     = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'phone'>('card')
  const [sdkReady, setSdkReady]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [orderData, setOrderData]     = useState<Record<string, string> | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // 로그인 정보 조회
  useEffect(() => {
    let mounted = true
    const token = localStorage.getItem('merlin_token') || localStorage.getItem('hub_token') || ''
    if (token) setAuthToken(token)

    fetch('/api/auth/me', {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!mounted) return
        const id = data?.user?.id || data?.user?.email || null
        if (id) {
          setUserId(id)
        } else {
          const fallback = localStorage.getItem('merlin_user_id') || localStorage.getItem('userEmail') || null
          setUserId(fallback)
        }
      })
      .catch(() => {
        if (!mounted) return
        const fallback = localStorage.getItem('merlin_user_id') || localStorage.getItem('userEmail') || null
        setUserId(fallback)
      })
    return () => { mounted = false }
  }, [])

  // Hub에 결제 준비 요청 → KCP 결제창 호출 데이터 수령
  const handlePayment = useCallback(async () => {
    if (selectedPlan === null) return
    if (!userId) { setError('로그인이 필요합니다.'); return }
    if (!sdkReady) { setError('결제 모듈 로드 중입니다. 잠시 후 다시 시도해주세요.'); return }

    const plan = CREDIT_PLANS[selectedPlan]
    setLoading(true)
    setError(null)

    try {
      // Hub에서 ordr_idxx 발급
      const hubUrl = process.env.NEXT_PUBLIC_HUB_URL || 'https://merlin-family-hub.onrender.com'
      const token  = authToken || localStorage.getItem('merlin_token') || localStorage.getItem('hub_token') || ''

      const res = await fetch(`${hubUrl}/api/payment/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          amount:      plan.price,
          coin_amount: plan.coins,
          app_id:      'AGGROFILTER',
          pay_method_type: paymentMethod,
          return_url:  returnUrl
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || '결제 준비에 실패했습니다.')
      }

      const data = await res.json()
      if (!data.success || !data.payment_data) {
        throw new Error(data.message || '결제 데이터를 받지 못했습니다.')
      }

      // KCP 폼 데이터 세팅 후 결제창 호출
      setOrderData(data.payment_data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.'
      setError(msg)
      setLoading(false)
    }
  }, [selectedPlan, userId, sdkReady, paymentMethod, returnUrl, authToken])

  // orderData가 세팅되면 KCP 결제창 호출
  useEffect(() => {
    if (!orderData) return
    if (typeof window.js_f_pay !== 'function') {
      setError('KCP 결제 모듈이 로드되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.')
      setLoading(false)
      return
    }
    // 다음 tick에 호출 (React 렌더 완료 후)
    setTimeout(() => {
      try {
        window.js_f_pay('kcp_payment_form')
      } catch (e) {
        console.error('[KCP] js_f_pay 호출 오류:', e)
        setError('결제창 호출에 실패했습니다.')
        setLoading(false)
      }
    }, 100)
  }, [orderData])

  const plan = selectedPlan !== null ? CREDIT_PLANS[selectedPlan] : null

  return (
    // 팝업 전용: 헤더/푸터 없음, 빈 흰 배경
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* KCP payplus_web.jsp — beforeInteractive로 페이지 로드 전 실행 보장 */}
      <Script
        id="kcp-payplus"
        src="https://pay.kcp.co.kr/plugin/payplus_web.jsp"
        strategy="beforeInteractive"
        onLoad={() => {
          console.log('[KCP] payplus_web.jsp loaded, js_f_pay:', typeof window.js_f_pay)
          setSdkReady(true)
        }}
        onError={() => {
          console.error('[KCP] payplus_web.jsp failed to load')
          setError('KCP 결제 스크립트를 불러오지 못했습니다.')
        }}
      />

      {/* ─── KCP 히든 폼 (js_f_pay가 참조) ─── */}
      {orderData && (
        <form
          id="kcp_payment_form"
          name="kcp_payment_form"
          ref={formRef}
          method="POST"
          style={{ display: 'none' }}
        >
          <input type="hidden" name="site_cd"    value={orderData.site_cd    || ''} />
          <input type="hidden" name="ordr_idxx"  value={orderData.ordr_idxx  || ''} />
          <input type="hidden" name="good_mny"   value={String(orderData.good_mny   || '')} />
          <input type="hidden" name="good_name"  value={orderData.good_name  || ''} />
          <input type="hidden" name="buyr_name"  value={orderData.buyr_name  || ''} />
          <input type="hidden" name="buyr_mail"  value={orderData.buyr_mail  || ''} />
          <input type="hidden" name="site_name"  value={orderData.site_name  || ''} />
          <input type="hidden" name="pay_method" value={orderData.pay_method || ''} />
          <input type="hidden" name="req_tx"     value="pay" />
          <input type="hidden" name="currency"   value="WON" />
          {/* Hub 콜백 URL: param_opt_1에 기록해 두면 Hub /api/payment/callback에서 꺼냄 */}
          <input type="hidden" name="param_opt_1" value={returnUrl} />
          {/* KCP 결제창 결과가 돌아올 서버 URL */}
          <input
            type="hidden"
            name="Ret_URL"
            value={`${process.env.NEXT_PUBLIC_HUB_URL || 'https://merlin-family-hub.onrender.com'}/api/payment/callback`}
          />
        </form>
      )}

      <main className="w-full max-w-lg">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-black text-slate-900">어그로필터 코인 충전</h1>
          <p className="mt-2 text-sm text-slate-600">
            AI 신뢰도 분석에 사용할 코인을 충전하세요.
          </p>

          {userId && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-xs text-slate-500">결제 계정: </span>
              <span className="text-sm font-bold text-slate-900">{userId}</span>
            </div>
          )}

          {/* 1. 상품 선택 */}
          <div className="mt-6 space-y-3">
            <h2 className="text-base font-black text-slate-900">1. 충전 상품 선택</h2>
            {CREDIT_PLANS.map((p, idx) => (
              <button
                key={p.coins}
                onClick={() => setSelectedPlan(idx)}
                className={
                  'w-full rounded-xl px-5 py-4 text-left border-2 transition-all ' +
                  (selectedPlan === idx
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-slate-300')
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-slate-900">{p.label}</span>
                  <span className="text-base font-black text-indigo-600">{p.desc}</span>
                </div>
              </button>
            ))}
          </div>

          {/* 2. 결제 수단 선택 */}
          <div className="mt-6">
            <h2 className="text-base font-black text-slate-900 mb-4">2. 결제 수단 선택</h2>
            <div role="radiogroup" aria-label="결제 수단" className="grid grid-cols-2 gap-3">
              {(['card', 'phone'] as const).map((method) => (
                <label
                  key={method}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 transition-all cursor-pointer ${
                    paymentMethod === method
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span className="text-lg">{method === 'card' ? '💳' : '📱'}</span>
                  <span className="font-bold">{method === 'card' ? '신용카드' : '휴대폰 결제'}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            id="kcp-pay-btn"
            onClick={handlePayment}
            disabled={selectedPlan === null || loading || !userId}
            className={
              'mt-6 w-full rounded-xl px-4 py-3.5 text-sm font-black transition-colors ' +
              (selectedPlan !== null && !loading && userId
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed')
            }
          >
            {loading
              ? '결제 준비 중...'
              : !userId
              ? '로그인 필요'
              : !sdkReady
              ? 'KCP 모듈 로딩 중...'
              : plan
              ? `${plan.price.toLocaleString()}원 결제하기`
              : '상품을 선택해주세요'}
          </button>

          <button
            onClick={() => window.close()}
            className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            취소하고 닫기
          </button>
        </div>

        {/* 정책 고지 */}
        <div className="mt-6 rounded-xl bg-slate-100 border border-slate-200 p-5 text-xs text-slate-500 space-y-3">
          <div>
            <p className="font-bold text-slate-700 mb-1">상품정보</p>
            <p>본 상품은 어그로필터 AI 신뢰도 분석을 이용할 수 있는 디지털 코인입니다.</p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">환불 정책</p>
            <p>결제 완료 즉시 계정으로 지급되는 디지털 재화입니다. 결제 후 7일 이내, 1회도 사용하지 않은 경우에 한해 전액 환불 가능합니다.</p>
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
