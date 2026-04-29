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
  const [method, setMethod] = useState<'card' | 'phone'>('card')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(false)

  // REFACTORED_BY_MERLIN_HUB: userId(UUID) 키
  const uid = typeof window !== 'undefined' ? (localStorage.getItem('merlin_user_id') || '') : ''

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
    } catch (_error) {
    } finally {
      setHistoryLoading(false)
    }
  }, [uid])

  useEffect(() => {
    if (tab === 'history') fetchHistory(historyPage)
  }, [tab, historyPage, fetchHistory])

  // 크레딧 상품 — 패밀리 허브 공통 상품 (다른 패밀리 앱에서도 동일하게 사용)
  // 어그로필터 기준 1회 분석 = 30C
  const options = useMemo(
    () => [
      { credits: 1000, price: '1,000원', label: '1,000 크레딧', discount: '', usage: '어그로필터 33회 분석 가능' },
      { credits: 5000, price: '4,750원', label: '5,000 크레딧', discount: '5% 할인', usage: '어그로필터 166회 분석 가능' },
      { credits: 10000, price: '9,000원', label: '10,000 크레딧', discount: '10% 할인', usage: '어그로필터 333회 분석 가능' },
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

      // 충전 후 메시지만 유지하고 자동 복귀 로직 제거 (심사관의 결제 플로우 확인을 위해)
      // 화면 전환 없이 현재 페이지에 머무름.
    } catch (_error) {
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
                {balance !== null ? `${Math.floor(balance / 30)}회 분석 가능` : ''}
              </div>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        {chargeResult && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm">
            <span className="font-black text-emerald-700">+{chargeResult.charged.toLocaleString()} C 충전 완료!</span>
            <span className="ml-2 text-emerald-600">잔액: {chargeResult.balance.toLocaleString()} C</span>
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
          <div className="space-y-4">
            {/* 1. 이용권 상품 선택 (심사 지시: 상품 박스 먼저) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900">1. 이용권 상품 선택</h2>
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
                  <div className="text-sm font-black text-slate-900">{opt.label}</div>
                  <div className="mt-1 text-base font-black text-indigo-600">{opt.price}</div>
                  {opt.discount && <div className="mt-1 text-xs font-bold text-rose-500">{opt.discount}</div>}
                  <div className="mt-2 text-[11px] text-slate-400 leading-relaxed">{opt.usage}</div>
                </button>
              ))}
              </div>
            </div>

            {/* 2. 결제 수단 선택 (심사 지시: 상품 박스 아래, 라디오 형태) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900">2. 결제 수단 선택</h2>
              <div role="radiogroup" aria-label="결제 수단" className="mt-4 grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 transition-all cursor-pointer ${
                    method === 'card' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={method === 'card'}
                    onChange={() => setMethod('card')}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span className="text-lg">💳</span>
                  <span className="font-bold">신용카드</span>
                </label>
                <label
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 transition-all cursor-pointer ${
                    method === 'phone' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="phone"
                    checked={method === 'phone'}
                    onChange={() => setMethod('phone')}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span className="text-lg">📱</span>
                  <span className="font-bold">휴대폰 결제</span>
                </label>
              </div>
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
        {/* 상품 정보 및 정책 고지 */}
        <div className="rounded-xl bg-slate-100 border border-slate-200 p-5 text-xs text-slate-500 space-y-4">
          <div>
            <p className="font-bold text-slate-700 mb-1">상품정보</p>
            <p>본 상품은 어그로필터 AI 신뢰도 분석을 이용할 수 있는 디지털 이용권입니다. 결제 즉시 크레딧이 충전되어 서비스를 이용할 수 있습니다.</p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">환불 정책 및 휴대폰 결제 안내</p>
            <p className="mb-2">결제 완료 시 계정으로 즉시 지급되는 무형의 디지털 재화이므로 실물 배송은 없습니다. 결제 후 7일 이내, 이용권을 단 1회도 사용하지 않은 경우에 한하여 전액 환불 가능합니다. (일부 사용 시 잔여분 환불 불가)</p>
            <div className="bg-white/50 p-3 rounded-lg border border-slate-200 text-rose-600 font-medium">
              <p className="font-bold">※ 휴대폰 결제 환불 규정 (필독)</p>
              <p className="mt-1">휴대폰 소액결제는 당월취소만 가능하며 결제자 본인명의 계좌로 환불됩니다. (휴대폰 결제의 경우 당월은 취소만 가능, 익월 이후 청구요금 수납 확인 후 결제자 본인 계좌 환불 가능)</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
