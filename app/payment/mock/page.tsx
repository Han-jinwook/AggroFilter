'use client'

import { Suspense, useMemo, useState, useEffect } from 'react'
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

  const redirectUrlParam = searchParams.get('redirectUrl') || '/'
  const redirectUrl = redirectUrlParam.startsWith('/') ? redirectUrlParam : '/'

  const [isPaying, setIsPaying] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [nickname, setNickname] = useState('')
  const [chargeResult, setChargeResult] = useState<{ charged: number; balance: number } | null>(null)

  useEffect(() => {
    const nick = localStorage.getItem('userNickname') || ''
    setNickname(nick)

    const uid = localStorage.getItem('userId') || ''
    const qs = uid ? `?userId=${encodeURIComponent(uid)}` : ''
    fetch(`/api/user/credits${qs}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (typeof d.credits === 'number') setBalance(d.credits) })
      .catch(() => {})
  }, [])

  const options = useMemo(
    () => [
      { credits: 1, price: '1,000원', label: '1 크레딧', desc: '' },
      { credits: 5, price: '4,500원', label: '5 크레딧', desc: '10% 할인' },
      { credits: 10, price: '8,000원', label: '10 크레딧', desc: '20% 할인' },
    ],
    []
  )

  const handlePay = async (credits: number) => {
    if (!nickname) {
      alert('로그인이 필요합니다.')
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      setIsPaying(true)
      setChargeResult(null)
      const uid = localStorage.getItem('userId') || ''
      const res = await fetch('/api/payment/mock-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits, userId: uid }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '충전 실패')
        return
      }
      setBalance(data.balance)
      setChargeResult({ charged: data.charged, balance: data.balance })
      // 헤더 크레딧 갱신 이벤트
      window.dispatchEvent(new CustomEvent('creditsUpdated'))
    } catch {
      alert('네트워크 오류')
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-[var(--app-max-width)] px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black text-slate-900">크레딧 충전</h1>
          <p className="mt-2 text-sm text-slate-600">
            테스트 모드 — 버튼을 누르면 즉시 크레딧이 충전됩니다. (실제 결제 없음)
          </p>

          <div className="mt-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border border-indigo-100">
            <div className="text-xs text-slate-500">내 계정</div>
            <div className="mt-1 text-sm font-bold text-slate-900">{nickname || '(로그인 필요)'}</div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-500">보유 크레딧</span>
              <span className="text-lg font-black text-indigo-600">{balance !== null ? `${balance} C` : '...'}</span>
            </div>
          </div>

          {chargeResult && (
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm">
              <span className="font-black text-emerald-700">+{chargeResult.charged} C 충전 완료!</span>
              <span className="ml-2 text-emerald-600">잔액: {chargeResult.balance} C</span>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {options.map((opt) => (
              <button
                key={opt.credits}
                disabled={isPaying}
                onClick={() => handlePay(opt.credits)}
                className={
                  'rounded-xl px-4 py-4 text-center border-2 transition-all ' +
                  (isPaying
                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-white border-indigo-200 hover:border-indigo-500 hover:shadow-md')
                }
              >
                <div className="text-lg font-black text-indigo-600">{opt.label}</div>
                <div className="mt-1 text-sm font-bold text-slate-700">{opt.price}</div>
                {opt.desc && <div className="mt-1 text-xs font-bold text-rose-500">{opt.desc}</div>}
              </button>
            ))}
          </div>

          <button
            disabled={isPaying}
            onClick={() => router.push(redirectUrl)}
            className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            돌아가기
          </button>
        </div>
      </main>
    </div>
  )
}
