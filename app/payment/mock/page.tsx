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

  // REFACTORED_BY_MERLIN_HUB: userId → merlin_family_uid
  const uid = typeof window !== 'undefined' ? (localStorage.getItem('merlin_family_uid') || '') : ''

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
      { credits: 1000, price: '1,000원', label: '🎫 [베이직] 33회 분석 이용권', desc: '' },
      { credits: 5000, price: '4,500원', label: '💎 [프로] 166회 분석 이용권', desc: '10% 할인' },
      { credits: 10000, price: '9,000원', label: '👑 [프리미엄] 333회 분석 이용권', desc: '10% 할인' },
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
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900">1. 결제 수단 선택</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMethod('card')}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 transition-all ${
                    method === 'card' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span className="text-lg">💳</span>
                  <span className="font-bold">신용카드</span>
                </button>
                <button
                  onClick={() => setMethod('phone')}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 transition-all ${
                    method === 'phone' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span className="text-lg">📱</span>
                  <span className="font-bold">휴대폰 결제</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900">2. 이용권 상품 선택</h2>
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
                  {opt.desc && <div className="mt-1 text-xs font-bold text-rose-500">{opt.desc}</div>}
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
        )
      }

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
              <p>※ 휴대폰 결제 주의사항:</p>
              <p className="mt-1">1. 휴대폰 소액결제는 결제 당월(1일~말일)에 한해 취소가 가능합니다.</p>
              <p>2. 결제 월이 지난 후(익월) 환불 요청 시에는 휴대폰 결제 취소가 불가능하며, 결제자 본인 명의의 계좌로 환불 수수료(결제 금액의 약 4.1%~5.5%)를 제외한 금액이 입금됩니다.</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200">
            <p className="font-bold text-slate-700 mb-1">고객센터 및 판매자 정보</p>
            <p>상호: 썬드림 주식회사 | 대표: 한진욱 | 이메일: beakes@naver.com</p>
            <p>전화: 010-2597-7502 (평일 10:00~18:00)</p>
          </div>
        </div>
      </main>
    </div>
  )
}
