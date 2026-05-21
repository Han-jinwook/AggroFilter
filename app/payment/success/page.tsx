'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // KCP 콜백: order_id 파라미터 (Hub가 리다이렉트 시 붙여줌)
  const orderId    = searchParams.get('order_id') || searchParams.get('orderId') || ''
  const redirectUrl = searchParams.get('redirectUrl') || '/'

  const [status, setStatus]   = useState<'confirming' | 'success' | 'error'>('confirming')
  const [coins, setCoins]     = useState<number>(0)
  const [balance, setBalance] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPopup, setIsPopup] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsPopup(!!window.opener)
    }
  }, [])

  useEffect(() => {
    if (!orderId) {
      setStatus('error')
      setErrorMsg('결제 정보가 올바르지 않습니다.')
      return
    }

    // Hub에서 이미 콜백 처리 완료 → 지갑 잔액만 조회
    let mounted = true

    // 결제 성공 이벤트 발생 (부모 창 갱신용)
    window.dispatchEvent(new CustomEvent('creditsUpdated'))
    if (window.opener) {
      try { window.opener.dispatchEvent(new CustomEvent('creditsUpdated')) } catch (e) {}
    }

    fetch('/api/wallet/balance', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { balance: 0 })
      .then(data => {
        if (!mounted) return
        setBalance(data.balance || 0)
        setStatus('success')
      })
      .catch(() => {
        if (!mounted) return
        setStatus('success') // 잔액 조회 실패해도 결제 성공으로 표시
      })

    return () => { mounted = false }
  }, [orderId])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg text-center">

          {status === 'confirming' && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <h1 className="mt-4 text-xl font-black text-slate-900">결제 확인 중...</h1>
              <p className="mt-2 text-sm text-slate-600">잠시만 기다려주세요.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="mt-4 text-xl font-black text-slate-900">결제 완료!</h1>
              <p className="mt-2 text-sm text-slate-600">코인이 계정으로 충전되었습니다.</p>
              {balance > 0 && (
                <div className="mt-4 inline-block rounded-xl bg-slate-50 border border-slate-200 px-6 py-3">
                  <div className="text-xs text-slate-500">현재 보유 코인</div>
                  <div className="text-2xl font-black text-slate-900">{balance}C</div>
                </div>
              )}
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="mt-4 text-xl font-black text-slate-900">결제 실패</h1>
              <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
            </>
          )}

          <div className="flex flex-col gap-3 mt-6">
            {status === 'success' && (
              isPopup ? (
                <>
                  <button
                    onClick={() => window.close()}
                    className="w-full rounded-xl px-4 py-3 text-sm font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    결제창 닫기
                  </button>
                  <button
                    onClick={() => router.push(redirectUrl)}
                    className="w-full rounded-xl px-4 py-3 text-sm font-black bg-slate-100 text-slate-900 hover:bg-slate-200 transition-colors"
                  >
                    {redirectUrl === '/' ? '메인으로 돌아가기' : '이전 페이지로 돌아가기'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => router.push(redirectUrl)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  {redirectUrl === '/' ? '메인으로 돌아가기' : '이전 페이지로 돌아가기'}
                </button>
              )
            )}
            {status !== 'success' && (
              <button
                onClick={() => router.push(redirectUrl)}
                className="w-full rounded-xl px-4 py-3 text-sm font-black bg-slate-100 text-slate-900 hover:bg-slate-200 transition-colors"
              >
                다시 시도
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
