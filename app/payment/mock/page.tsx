'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/c-app-header'

export default function MockPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <MockPaymentContent />
    </Suspense>
  )
}

function MockPaymentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const userId = searchParams.get('userId') || ''
  const redirectUrlParam = searchParams.get('redirectUrl') || '/'
  const redirectUrl = redirectUrlParam.startsWith('/') ? redirectUrlParam : '/'

  const [isPaying, setIsPaying] = useState(false)

  const options = useMemo(
    () => [
      { credits: 1, label: '1,000원 결제 (1크레딧)' },
      { credits: 5, label: '4,500원 결제 (5크레딧) (10% 할인)' },
      { credits: 10, label: '8,000원 결제 (10크레딧) (20% 할인)' },
    ],
    []
  )

  const handlePay = async (credits: number) => {
    if (!userId) {
      alert('로그인이 필요합니다.')
      return
    }

    try {
      setIsPaying(true)
      const callbackUrl = `/api/payment/callback?status=success&amount=${credits}&userId=${encodeURIComponent(userId)}&redirectUrl=${encodeURIComponent(redirectUrl)}`
      router.push(callbackUrl)
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-[var(--app-max-width)] px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black text-slate-900">결제 테스트</h1>
          <p className="mt-2 text-sm text-slate-600">
            현재 테스트 모드입니다. (소액결제 추후 추가 예정) 아래 버튼을 누르면 해당 크레딧이 충전된 것으로 처리됩니다.
          </p>

          <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div className="text-xs text-slate-500">결제 대상</div>
            <div className="mt-1 text-sm font-bold text-slate-900 break-all">{userId || '-'}</div>
            <div className="mt-3 text-xs text-slate-500">복귀 페이지</div>
            <div className="mt-1 text-sm font-bold text-slate-900 break-all">{redirectUrl}</div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {options.map((opt) => (
              <button
                key={opt.credits}
                disabled={isPaying}
                onClick={() => handlePay(opt.credits)}
                className={
                  'rounded-xl px-4 py-3 text-sm font-black border transition-colors ' +
                  (isPaying
                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            disabled={isPaying}
            onClick={() => router.push(redirectUrl)}
            className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            취소하고 돌아가기
          </button>
        </div>
      </main>
    </div>
  )
}
