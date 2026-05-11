'use client'

import { Suspense, useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppHeader } from '@/components/c-app-header'
import { requestKcpPayment, MerlinHub, hubFetch } from '@/src/services/merlin-hub-sdk'

interface HistoryItem {
  id: number
  type: string
  amount: number
  balance: number
  description: string
  display_text?: string
  createdAt: string
  created_at?: string
}

// 스마트 제목 리졸버 컴포넌트
function TransactionDescription({ initialText }: { initialText: string }) {
  const [displayText, setDisplayText] = useState(initialText)
  
  useEffect(() => {
    // 11자리 유튜브 ID 패턴 감지 (예: qs3yA1cV5fc)
    const match = initialText.match(/[a-zA-Z0-9_-]{11}/)
    if (match && initialText.includes('영상 분석')) {
      const videoId = match[0]
      fetch(`/api/video/title?id=${videoId}`)
        .then(res => res.json())
        .then(data => {
          if (data.title) {
            setDisplayText(initialText.replace(videoId, data.title))
          }
        })
        .catch(() => {})
    }
  }, [initialText])

  return <span className="truncate">{displayText}</span>
}

export default function PurchasePaymentPage() {
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
  
  const [origin, setOrigin] = useState('')

  const uid = typeof window !== 'undefined' ? (localStorage.getItem('merlin_user_id') || '') : ''

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
      const nick = localStorage.getItem('userNickname') || ''
      setNickname(nick)

      hubFetch('/api/wallet/balance')
        .then(res => {
          if (res.ok && typeof res.data.balance === 'number') {
            setBalance(res.data.balance)
          }
        })
        .catch(() => {})
    }
  }, [uid])

  const fetchHistory = useCallback(async (page: number) => {
    if (!uid) return
    setHistoryLoading(true)
    try {
      const res = await hubFetch(`/api/wallet/history?page=${page}&userId=${encodeURIComponent(uid)}`)
      if (res.ok && res.data.history) {
        setHistory(res.data.history)
        setHistoryTotalPages(res.data.totalPages || 1)
        setHistoryPage(res.data.page || 1)
      }
    } catch (_error) {
    } finally {
      setHistoryLoading(false)
    }
  }, [uid])

  useEffect(() => {
    if (tab === 'history') fetchHistory(historyPage)
  }, [tab, historyPage, fetchHistory])

  const options = useMemo(
    () => [
      { credits: 1000, price: 1000, imgSrc: '/images/payment/card_1000.jpg' },
      { credits: 5000, price: 4750, imgSrc: '/images/payment/card_5000.png' },
      { credits: 10000, price: 9000, imgSrc: '/images/payment/card_10000.jpg' },
    ],
    []
  )

  const selectedPkg = useMemo(() => options.find(o => o.credits === selectedOption) || options[0], [selectedOption, options])

  const handlePay = async () => {
    if (!nickname) {
      alert('로그인이 필요합니다.')
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      setIsPaying(true)
      const result = await requestKcpPayment({
        amount: selectedPkg.price,
        coinAmount: selectedPkg.credits,
        payMethodType: method,
        returnUrl: `${origin}/api/payment/callback`
      })

      if (!result.success || !result.paymentData) {
        alert(result.error || '결제 준비 실패')
        return
      }

      const params = result.paymentData
      const qs = new URLSearchParams({
        ordr_idxx:  params.ordr_idxx  || '',
        good_name:  params.good_name  || '',
        good_mny:   String(params.good_mny || ''),
        buyr_name:  nickname,
        site_cd:    params.site_cd    || 'ALRJ8',
        pay_method: params.pay_method || '',
        param_opt_1: origin,
        Ret_URL:    `${MerlinHub.getConfig().hubUrl}/api/payment/callback`,
      }).toString()

      window.open(
        `/api/payment/kcp-page?${qs}`,
        'kcp_payment_popup',
        'width=760,height=580,scrollbars=yes,resizable=yes,left=200,top=100'
      )
    } catch (err: any) {
      alert(err?.message || '네트워크 오류가 발생했습니다.')
    } finally {
      setIsPaying(false)
    }
  }

  const formatDate = (iso: string) => {
    if (!iso) return '...';
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '...';
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-[var(--app-max-width)] px-4 py-8 space-y-4">
        <div className="flex items-center justify-start pb-2">
          <Link href={redirectUrl} className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:shadow-md active:scale-95 group">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            홈으로 돌아가기
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">{nickname || '(로그인 필요)'}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600">{balance !== null ? balance.toLocaleString() : '…'}</span>
                <span className="text-sm font-bold text-slate-500">C</span>
              </div>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          <button onClick={() => setTab('charge')} className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${tab === 'charge' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>충전하기</button>
          <button onClick={() => setTab('history')} className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${tab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>이용 내역</button>
        </div>

        {tab === 'charge' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900 mb-5">1. 이용권 상품 선택</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {options.map((opt) => (
                  <button key={opt.credits} onClick={() => setSelectedOption(opt.credits)} className={`relative rounded-2xl overflow-hidden transition-all hover:scale-[1.03] shadow-lg ${selectedOption === opt.credits ? 'ring-4 ring-indigo-600' : ''}`}>
                    <img src={opt.imgSrc} alt={`${opt.credits} Coins`} className="w-full h-auto" />
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900">2. 결제 수단 선택</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 cursor-pointer ${method === 'card' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50'}`}>
                  <input type="radio" checked={method === 'card'} onChange={() => setMethod('card')} className="h-4 w-4" />
                  <span className="font-bold">신용카드</span>
                </label>
                <label className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 cursor-pointer ${method === 'phone' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50'}`}>
                  <input type="radio" checked={method === 'phone'} onChange={() => setMethod('phone')} className="h-4 w-4" />
                  <span className="font-bold">휴대폰 결제</span>
                </label>
              </div>
            </div>
            <button onClick={() => handlePay()} className="w-full rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-xl hover:bg-indigo-700 active:scale-[0.98]">
              {selectedOption.toLocaleString()} 코인 결제하기
            </button>
          </div>
        )}

        {tab === 'history' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-black text-slate-900">이용 내역</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {history.map((item) => {
                const rawDesc = item.display_text || item.description || ''
                let formattedDesc = rawDesc.replace('(신규)', '').replace('KCP 심사관 테스트 코인 충전 (5,000C)', '코인 충전').trim()
                if (!formattedDesc.startsWith('어그로필터')) formattedDesc = `어그로필터 - ${formattedDesc}`

                return (
                  <div key={item.id} className="py-3 group">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-bold text-slate-800 truncate flex-1">
                        <TransactionDescription initialText={formattedDesc} />
                      </div>
                      <div className={`text-sm font-black shrink-0 ${Number(item.amount) > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {Number(item.amount) > 0 ? '+' : ''}{Number(item.amount || 0).toLocaleString()} C
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="text-[10px] font-medium text-slate-400">{formatDate(item.created_at || item.createdAt)}</div>
                      {item.balance !== null && <div className="text-[10px] font-bold text-slate-300">잔액 {Number(item.balance).toLocaleString()} C</div>}
                    </div>
                  </div>
                )
              })}
            </div>
            {historyTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)} className="rounded-lg px-3 py-1.5 text-xs font-bold border border-slate-200">이전</button>
                <span className="text-xs text-slate-500">{historyPage} / {historyTotalPages}</span>
                <button disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage(p => p + 1)} className="rounded-lg px-3 py-1.5 text-xs font-bold border border-slate-200">다음</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
