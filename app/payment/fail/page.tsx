'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/c-app-header'

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <PaymentFailContent />
    </Suspense>
  )
}

function PaymentFailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const code = searchParams.get('code') || ''
  const message = searchParams.get('message') || '결제가 취소되었거나 실패했습니다.'
  const redirectUrl = searchParams.get('redirectUrl') || '/'

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-[var(--app-max-width)] px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-black text-slate-900">결제 실패</h1>
          <p className="mt-2 text-sm text-red-600">{message}</p>
          {code && (
            <p className="mt-1 text-xs text-slate-400">코드: {code}</p>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={() => router.push('/payment/checkout?redirectUrl=' + encodeURIComponent(redirectUrl))}
              className="w-full rounded-xl px-4 py-3 text-sm font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              다시 시도
            </button>
            <button
              onClick={() => router.push(redirectUrl)}
              className="w-full rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              돌아가기
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
