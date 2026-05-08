'use client'

import { Suspense, useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppHeader } from '@/components/c-app-header'
import { requestKcpPayment, MerlinHub } from '@/src/services/merlin-hub-sdk'

interface HistoryItem {
  id: number
  type: string
  amount: number
  balance: number
  description: string
  createdAt: string
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
  
  const [kcpParams, setKcpParams] = useState<any>(null)
  const [origin, setOrigin] = useState('')
  const [isKcpScriptLoaded, setIsKcpScriptLoaded] = useState(true)

  // REFACTORED_BY_MERLIN_HUB: userId(UUID) 키
  const uid = typeof window !== 'undefined' ? (localStorage.getItem('merlin_user_id') || '') : ''

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
      const nick = localStorage.getItem('userNickname') || ''
      setNickname(nick)

      const qs = uid ? `?userId=${encodeURIComponent(uid)}` : ''
      fetch(`/api/user/credits${qs}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (typeof d.credits === 'number') setBalance(d.credits) })
        .catch(() => {})

    }
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

  // 코인 상품 — 패밀리 허브 공통 상품
  const options = useMemo(
    () => [
      { credits: 1000, price: 1000, imgSrc: '/images/payment/card_1000.jpg' },
      { credits: 5000, price: 4750, imgSrc: '/images/payment/card_5000.png' },
      { credits: 10000, price: 9000, imgSrc: '/images/payment/card_10000.jpg' },
    ],
    []
  )

  const selectedPkg = useMemo(() => options.find(o => o.credits === selectedOption) || options[0], [selectedOption, options])

  // KCP 스크립트를 동적으로 로드하고, js_f_pay가 정의될 때까지 기다리는 Promise
  const loadKcpScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // 이미 로드되어 있으면 즉시 resolve
      if ((window as any).js_f_pay) {
        console.log('[KCP] js_f_pay already available.');
        resolve();
        return;
      }

      // 기존에 삽입된 스크립트가 있으면 제거 후 재삽입 (캐시 초기화)
      const existing = document.getElementById('kcp-payplus-script');
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.id = 'kcp-payplus-script';
      script.src = 'https://pay.kcp.co.kr/plugin/payplus_web.jsp';
      script.async = false; // 동기 로드 강제

      script.onload = () => {
        console.log('[KCP] Script loaded. Waiting for js_f_pay initialization...');
        // 스크립트 로드 후 js_f_pay가 정의될 때까지 폴링 (최대 3초)
        let attempts = 0;
        const poll = setInterval(() => {
          if ((window as any).js_f_pay) {
            clearInterval(poll);
            console.log('[KCP] js_f_pay is ready!');
            resolve();
          } else if (attempts++ > 30) { // 100ms * 30 = 3초
            clearInterval(poll);
            reject(new Error('KCP 스크립트가 로드되었으나 js_f_pay 함수를 찾을 수 없습니다.'));
          }
        }, 100);
      };

      script.onerror = () => {
        reject(new Error('KCP 스크립트 파일을 불러오는 데 실패했습니다. 네트워크 연결을 확인해 주세요.'));
      };

      document.body.appendChild(script);
    });
  };

  const handlePay = async () => {
    if (!nickname) {
      alert('로그인이 필요합니다.')
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      setIsPaying(true)

      // 1단계: KCP 스크립트 로드 확인 (결제 버튼 클릭 시 최초 1회)
      await loadKcpScript();
      
      // 2단계: 허브에서 결제 준비 데이터 요청
      const result = await requestKcpPayment({
        amount: selectedPkg.price,
        coinAmount: selectedPkg.credits,
        payMethodType: method,
        returnUrl: `${origin}/api/payment/callback`
      });

      if (!result.success || !result.paymentData) {
        alert(result.error || '결제 준비 실패');
        return;
      }

      // 3단계: 폼 데이터 세팅 후 KCP 팝업 호출
      setKcpParams(result.paymentData);

      // React state 업데이트가 DOM에 반영될 때까지 한 프레임 대기
      await new Promise(r => setTimeout(r, 100));

      const form = document.querySelector('form[name="order_info"]') as any;
      if (form && (window as any).js_f_pay) {
        console.log('[KCP] Triggering payment popup...');
        (window as any).js_f_pay(form);
      } else {
        alert('결제 모듈 초기화에 실패했습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
      }

    } catch (err: any) {
      console.error('[KCP] Error:', err);
      alert(err?.message || '네트워크 오류가 발생했습니다.');
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
        {/* KCP Hidden Form */}
        <form name="order_info" method="post" style={{ display: 'none' }}>
          <input type="hidden" name="ordr_idxx" value={kcpParams?.ordr_idxx || ''} />
          <input type="hidden" name="good_name" value={kcpParams?.good_name || ''} />
          <input type="hidden" name="good_mny" value={kcpParams?.good_mny || ''} />
          <input type="hidden" name="buyr_name" value={nickname || ''} />
          <input type="hidden" name="buyr_mail" value="" />
          <input type="hidden" name="site_cd" value={kcpParams?.site_cd || 'ALRJ8'} />
          <input type="hidden" name="site_name" value="어그로필터" />
          <input type="hidden" name="pay_method" value={kcpParams?.pay_method || ''} />
          <input type="hidden" name="req_tx" value="pay" />
          <input type="hidden" name="currency" value="WON" />
          <input type="hidden" name="module_type" value="01" />
          <input type="hidden" name="res_cd" value="" />
          <input type="hidden" name="res_msg" value="" />
          <input type="hidden" name="enc_info" value="" />
          <input type="hidden" name="enc_data" value="" />
          <input type="hidden" name="ret_pay_method" value="" />
          <input type="hidden" name="tran_cd" value="" />
          <input type="hidden" name="use_pay_method" value="" />
          <input type="hidden" name="buyr_tel1" value="" />
          <input type="hidden" name="buyr_tel2" value="" />
          <input type="hidden" name="param_opt_1" value={origin} />
          <input type="hidden" name="Ret_URL" value={`${MerlinHub.getConfig().hubUrl}/api/payment/callback`} />
        </form>
        {/* 상단 네비게이션 */}
        <div className="flex items-center justify-start pb-2">
          <Link
            href={redirectUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-white hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md active:scale-95 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            홈으로 돌아가기
          </Link>
        </div>

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

            <div className="pt-2">
              <button
                disabled={isPaying || balance === null || !isKcpScriptLoaded}
                onClick={() => handlePay()}
                className="w-full relative flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 py-5 text-lg font-black text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 overflow-hidden"
              >
                {isPaying && (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{selectedOption.toLocaleString()} 코인 결제하기</span>
                
                {/* 비정상적인 결제 느낌 방지를 위한 안전 장치 */}
                <div className="absolute inset-0 pointer-events-none bg-white/0 group-active:bg-white/10 transition-colors" />
              </button>
              
              <Link
                href={redirectUrl}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:bg-white hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md active:scale-95 group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                홈으로 돌아가기
              </Link>
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
