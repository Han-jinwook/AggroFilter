'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/c-app-header'

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

  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')
  const redirectUrl = searchParams.get('redirectUrl') || '/'

  const [status, setStatus] = useState<'confirming' | 'success' | 'error'>('confirming')
  const [result, setResult] = useState<{ credits: number; totalCredits: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setStatus('error')
      setErrorMsg('결제 정보가 올바르지 않습니다.')
      return
    }

    let isMounted = true

    fetch('/api/payment/toss/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!isMounted) return
        if (res.ok && data.success) {
          setResult({ credits: data.credits, totalCredits: data.totalCredits })
          setStatus('success')
        } else {
          setErrorMsg(data.error || '결제 승인에 실패했습니다.')
          setStatus('error')
        }
      })
      .catch(() => {
        if (!isMounted) return
        setErrorMsg('결제 처리 중 오류가 발생했습니다.')
        setStatus('error')
      })

    return () => { isMounted = false }
  }, [paymentKey, orderId, amount])

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-[var(--app-max-width)] px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">

          {status === 'confirming' && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <h1 className="mt-4 text-xl font-black text-slate-900">결제 승인 중...</h1>
              <p className="mt-2 text-sm text-slate-600">잠시만 기다려주세요.</p>
            </>
          )}

          {status === 'success' && result && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="mt-4 text-xl font-black text-slate-900">결제 완료!</h1>
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-bold text-indigo-600">{result.credits}크레딧</span>이 충전되었습니다.
              </p>
              <div className="mt-4 inline-block rounded-xl bg-slate-50 border border-slate-200 px-6 py-3">
                <div className="text-xs text-slate-500">보유 크레딧</div>
                <div className="text-2xl font-black text-slate-900">{result.totalCredits}</div>
              </div>
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

          <button
            onClick={() => router.push(redirectUrl)}
            className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            {status === 'success' ? '돌아가기' : '다시 시도'}
          </button>
        </div>
      </main>
    </div>
  )
}
