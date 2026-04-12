'use client'

import { Suspense, useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/c-app-header'

interface HistoryItem {
  id: number
  type: string
  amount: number
  balance: number
  description: string
  createdAt: string
}

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
  const [tab, setTab] = useState<'charge' | 'history'>('charge')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(false)

  const uid = typeof window !== 'undefined' ? (localStorage.getItem('userId') || '') : ''

  useEffect(() => {
    const nick = localStorage.getItem('userNickname') || ''
    setNickname(nick)

    const qs = uid ? `?userId=${encodeURIComponent(uid)}` : ''
    fetch(`/api/user/credits${qs}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (typeof d.credits === 'number') setBalance(d.credits) })
      .catch(() => {})
  }, [uid])

  const fetchHistory = useCallback(async (page: number) => {
    if (!uid) return
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/user/credit-history?userId=${encodeURIComponent(uid)}&page=${page}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.history) {
        setHistory(data.history)
        setHistoryTotalPages(data.totalPages || 1)
        setHistoryPage(data.page || 1)
      }
    } catch {} finally {
      setHistoryLoading(false)
    }
  }, [uid])

  useEffect(() => {
    if (tab === 'history') fetchHistory(historyPage)
  }, [tab, historyPage, fetchHistory])

  const options = useMemo(
    () => [
      { credits: 100, price: '1,000원', label: '100 C', desc: '10회 분석' },
      { credits: 500, price: '4,500원', label: '500 C', desc: '50회 분석 · 10% 할인' },
      { credits: 1000, price: '8,000원', label: '1,000 C', desc: '100회 분석 · 20% 할인' },
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
      window.dispatchEvent(new CustomEvent('creditsUpdated'))

      // 충전 후 원래 페이지로 자동 복귀 (2초 딜레이)
      if (redirectUrl && redirectUrl !== '/payment/mock') {
        setTimeout(() => {
          router.push(redirectUrl)
        }, 2000)
      }
    } catch {
      alert('네트워크 오류')
    } finally {
      setIsPaying(false)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-[var(--app-max-width)] px-4 py-8 space-y-4">

        {/* 잔액 카드 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">{nickname || '(로그인 필요)'}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600">{balance !== null ? balance.toLocaleString() : '…'}</span>
                <span className="text-sm font-bold text-slate-500">C</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {balance !== null ? `${Math.floor(balance / 10)}회 분석 가능` : ''}
              </div>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        {chargeResult && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm">
            <span className="font-black text-emerald-700">+{chargeResult.charged.toLocaleString()} C 충전 완료!</span>
            <span className="ml-2 text-emerald-600">잔액: {chargeResult.balance.toLocaleString()} C</span>
            {redirectUrl && redirectUrl !== '/payment/mock' && (
              <div className="mt-1 text-xs text-emerald-500">잠시 후 이전 페이지로 돌아갑니다…</div>
            )}
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setTab('charge')}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
              tab === 'charge' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            충전하기
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
              tab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            이용 내역
          </button>
        </div>

        {/* 충전 탭 */}
        {tab === 'charge' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-black text-slate-900">크레딧 충전</h2>
            <p className="mt-1 text-xs text-slate-500">
              테스트 모드 — 버튼 클릭 시 즉시 충전 (실제 결제 없음)
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {options.map((opt) => (
                <button
                  key={opt.credits}
                  disabled={isPaying}
                  onClick={() => handlePay(opt.credits)}
                  className={
                    'rounded-xl px-4 py-5 text-center border-2 transition-all ' +
                    (isPaying
                      ? 'bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white border-indigo-200 hover:border-indigo-500 hover:shadow-md')
                  }
                >
                  <div className="text-xl font-black text-indigo-600">{opt.label}</div>
                  <div className="mt-1 text-sm font-bold text-slate-700">{opt.price}</div>
                  <div className="mt-1 text-xs font-bold text-rose-500">{opt.desc}</div>
                </button>
              ))}
            </div>

            <button
              disabled={isPaying}
              onClick={() => router.push(redirectUrl)}
              className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              돌아가기
            </button>
          </div>
        )}

        {/* 이력 탭 */}
        {tab === 'history' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-black text-slate-900">이용 내역</h2>

            {historyLoading ? (
              <div className="mt-6 text-center text-sm text-slate-400">불러오는 중…</div>
            ) : history.length === 0 ? (
              <div className="mt-6 text-center text-sm text-slate-400">내역이 없습니다.</div>
            ) : (
              <>
                <div className="mt-4 divide-y divide-slate-100">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{item.description}</div>
                        <div className="text-xs text-slate-400">{formatDate(item.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-black ${item.amount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()} C
                        </div>
                        <div className="text-xs text-slate-400">잔액 {item.balance.toLocaleString()} C</div>
                      </div>
                    </div>
                  ))}
                </div>

                {historyTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage(p => p - 1)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold border border-slate-200 disabled:opacity-30"
                    >
                      이전
                    </button>
                    <span className="text-xs text-slate-500">{historyPage} / {historyTotalPages}</span>
                    <button
                      disabled={historyPage >= historyTotalPages}
                      onClick={() => setHistoryPage(p => p + 1)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold border border-slate-200 disabled:opacity-30"
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
