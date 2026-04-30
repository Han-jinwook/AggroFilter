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
  const [selectedOption, setSelectedOption] = useState<number>(1000)
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

  // 코인 상품 — 패밀리 허브 공통 상품 (다른 패밀리 앱에서도 동일하게 사용)
  // 어그로필터 기준 1회 분석 = 30C
  const options = useMemo(
    () => [
      { credits: 1000, imgSrc: '/images/payment/card_1000.jpg' },
      { credits: 5000, imgSrc: '/images/payment/card_5000.png' },
      { credits: 10000, imgSrc: '/images/payment/card_10000.jpg' },
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
              <h2 className="text-base font-black text-slate-900 mb-5 px-1">1. 이용권 상품 선택</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {options.map((opt) => (
                <button
                  key={opt.credits}
                  disabled={isPaying}
                  onClick={() => setSelectedOption(opt.credits)}
                  className={`group relative rounded-2xl overflow-hidden transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg ${
                    selectedOption === opt.credits 
                      ? 'ring-4 ring-indigo-600 shadow-indigo-200/80 scale-[1.05]' 
                      : 'hover:shadow-indigo-200/50'
                  }`}
                >
                  <img 
                    src={opt.imgSrc} 
                    alt={`${opt.credits} Coins`}
                    className="w-full h-auto object-cover block"
                  />
                  {selectedOption === opt.credits && (
                    <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full p-1.5 shadow-lg animate-in zoom-in duration-300">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors" />
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

            {/* 결제 버튼 */}
            <div className="pt-2">
              <button
                disabled={isPaying || balance === null}
                onClick={() => handlePay(selectedOption)}
                className="w-full relative flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 py-5 text-lg font-black text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 overflow-hidden"
              >
                {isPaying && (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{selectedOption.toLocaleString()} 코인 결제하기</span>
                
                {/* 비정상적인 결제 느낌 방지를 위한 안전 장치 */}
                <div className="absolute inset-0 pointer-events-none bg-white/0 group-active:bg-white/10 transition-colors" />
              </button>
              
              <button
                disabled={isPaying}
                onClick={() => router.push(redirectUrl)}
                className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                돌아가기
              </button>
            </div>
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
            <p>본 상품은 어그로필터 AI 신뢰도 분석을 이용할 수 있는 디지털 이용권입니다. 결제 즉시 코인이 충전되어 서비스를 이용할 수 있습니다.</p>
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
