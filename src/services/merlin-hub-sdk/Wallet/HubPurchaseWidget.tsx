/**
 * Version: v1.0.0
 * Last Updated: 2026-05-19
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { hubFetch } from '../CoreLogic/client';
import { HubPaymentTrigger } from './HubPaymentTrigger';
import { getConfig } from '../CoreLogic/config';

interface HistoryItem {
  id: number;
  type: string;
  amount: number;
  balance: number;
  description: string;
  display_text?: string;
  createdAt: string;
  created_at?: string;
}

interface HubPurchaseWidgetProps {
  appName?: string;
  redirectUrl?: string;
  onSuccess?: () => void;
  onError?: (err: string) => void;
}

export const HubPurchaseWidget: React.FC<HubPurchaseWidgetProps> = ({
  appName = '어그로필터',
  redirectUrl = '/',
  onSuccess,
  onError,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectUrlParam = searchParams.get('redirectUrl') || redirectUrl;
  const targetRedirectUrl = redirectUrlParam.startsWith('/') ? redirectUrlParam : '/';

  const [selectedOption, setSelectedOption] = useState<number>(1000);
  const [balance, setBalance] = useState<number | null>(null);
  const [nickname, setNickname] = useState('');
  const [tab, setTab] = useState<'charge' | 'history'>('charge');
  const [method, setMethod] = useState<'card' | 'phone' | 'bank'>('card');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [origin, setOrigin] = useState('');

  const uid = typeof window !== 'undefined' ? (localStorage.getItem('merlin_user_id') || '') : '';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      const nick = localStorage.getItem('userNickname') || '';
      setNickname(nick);

      hubFetch('/api/wallet/balance')
        .then((res) => {
          if (res.ok && typeof res.data.balance === 'number') {
            setBalance(res.data.balance);
          }
        })
        .catch(() => {});
    }
  }, [uid]);

  const fetchHistory = useCallback(async (page: number) => {
    if (!uid) return;
    setHistoryLoading(true);
    try {
      const res = await hubFetch(`/api/wallet/history?page=${page}&userId=${encodeURIComponent(uid)}`);
      if (res.ok && res.data.history) {
        setHistory(res.data.history);
        setHistoryTotalPages(res.data.totalPages || 1);
        setHistoryPage(res.data.page || 1);
      }
    } catch (_error) {
      // 에러 처리 무시
    } finally {
      setHistoryLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (tab === 'history') {
      fetchHistory(historyPage);
    }
  }, [tab, historyPage, fetchHistory]);

  const options = useMemo(
    () => [
      { credits: 1000, price: 1000, discount: 0, gradient: 'from-slate-900 to-indigo-950' },
      { credits: 5000, price: 4750, discount: 5, gradient: 'from-indigo-900 via-indigo-950 to-purple-950' },
      { credits: 10000, price: 9000, discount: 10, gradient: 'from-purple-900 via-violet-950 to-indigo-950' },
    ],
    []
  );

  const selectedPkg = useMemo(
    () => options.find((o) => o.credits === selectedOption) || options[0],
    [selectedOption, options]
  );

  const formatDate = (iso: string) => {
    if (!iso) return '...';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '...';
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  };

  const config = getConfig();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes hub-coin-float-1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(2deg); }
        }
        @keyframes hub-coin-float-2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-4deg); }
        }
        @keyframes hub-coin-float-3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(3deg); }
        }
        .hub-coin-1 { animation: hub-coin-float-1 5s ease-in-out infinite; }
        .hub-coin-2 { animation: hub-coin-float-2 6s ease-in-out infinite; }
        .hub-coin-3 { animation: hub-coin-float-3 4.4s ease-in-out infinite; }
      `}} />
      <main className="mx-auto max-w-[var(--app-max-width,720px)] px-4 py-8 space-y-4">
        {/* 상단 네비게이션 */}
        <div className="flex items-center justify-start pb-2">
          <button
            onClick={() => router.push(targetRedirectUrl)}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:shadow-md active:scale-95 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            홈으로 돌아가기
          </button>
        </div>

        {/* 잔액 표시 영역 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">{nickname || '(로그인 필요)'}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600">
                  {balance !== null ? balance.toLocaleString() : '…'}
                </span>
                <span className="text-sm font-bold text-slate-500">C</span>
              </div>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        {/* 탭 전환 영역 */}
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

        {/* 충전 탭 화면 */}
        {tab === 'charge' && (
          <div className="space-y-4">
            {/* 상품 선택 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900 mb-5">1. 이용권 상품 선택</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {options.map((opt) => {
                  const isSelected = selectedOption === opt.credits;
                  const isBestValue = opt.credits === 5000;
                  const discountPercent = opt.discount;

                  return (
                    <button
                      key={opt.credits}
                      onClick={() => setSelectedOption(opt.credits)}
                      className={`relative w-full text-left rounded-3xl overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-[0.99] border-2 ${
                        isSelected
                          ? 'border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.35)]'
                          : 'border-white/5'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #130c25 0%, #0d091a 100%)',
                        minHeight: '220px',
                      }}
                    >
                      {/* Decorative glowing gradient circle background */}
                      <div className="absolute -top-10 -left-10 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                      <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

                      {/* Floating glowing SVG coin graphics */}
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 w-28 h-28 flex items-center justify-center pointer-events-none select-none">
                        {/* Large coin */}
                        <div className="hub-coin-1">
                          <svg className="w-16 h-16 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="32" cy="32" r="30" fill="url(#coinGradOuter)" stroke="url(#coinBorderGrad)" strokeWidth="2" />
                            <circle cx="32" cy="32" r="24" fill="url(#coinGradInner)" />
                            <text x="32" y="39" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="900" fontFamily="sans-serif">C</text>
                            <defs>
                              <linearGradient id="coinGradOuter" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#6366F1" />
                                <stop offset="0.5" stopColor="#4F46E5" />
                                <stop offset="1" stopColor="#312E81" />
                              </linearGradient>
                              <linearGradient id="coinBorderGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#A5B4FC" />
                                <stop offset="1" stopColor="#312E81" />
                              </linearGradient>
                              <linearGradient id="coinGradInner" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#4F46E5" />
                                <stop offset="1" stopColor="#1E1B4B" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>

                        {/* Floating tiny coin left */}
                        <div className="absolute left-0 top-3 hub-coin-2">
                          <svg className="w-8 h-8 opacity-70 drop-shadow-[0_0_6px_rgba(99,102,241,0.3)]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="32" cy="32" r="30" fill="url(#coinGradOuter2)" stroke="url(#coinBorderGrad2)" strokeWidth="2" />
                            <circle cx="32" cy="32" r="24" fill="url(#coinGradInner2)" />
                            <text x="32" y="39" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="900" fontFamily="sans-serif">C</text>
                            <defs>
                              <linearGradient id="coinGradOuter2" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#818CF8" />
                                <stop offset="1" stopColor="#312E81" />
                              </linearGradient>
                              <linearGradient id="coinBorderGrad2" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#C7D2FE" />
                                <stop offset="1" stopColor="#1E1B4B" />
                              </linearGradient>
                              <linearGradient id="coinGradInner2" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#312E81" />
                                <stop offset="1" stopColor="#0F172A" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>

                        {/* Floating tiny coin right */}
                        <div className="absolute right-0 bottom-2 hub-coin-3">
                          <svg className="w-6 h-6 opacity-50 drop-shadow-[0_0_4px_rgba(168,85,247,0.3)]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="32" cy="32" r="30" fill="url(#coinGradOuter3)" stroke="url(#coinBorderGrad3)" strokeWidth="2" />
                            <circle cx="32" cy="32" r="24" fill="url(#coinGradInner3)" />
                            <text x="32" y="39" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="900" fontFamily="sans-serif">C</text>
                            <defs>
                              <linearGradient id="coinGradOuter3" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#A855F7" />
                                <stop offset="1" stopColor="#581C87" />
                              </linearGradient>
                              <linearGradient id="coinBorderGrad3" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#E9D5FF" />
                                <stop offset="1" stopColor="#3B0764" />
                              </linearGradient>
                              <linearGradient id="coinGradInner3" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#581C87" />
                                <stop offset="1" stopColor="#0F172A" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                      </div>

                      {/* Content Container */}
                      <div className="relative h-full flex flex-col justify-between p-6 z-10">
                        {/* Upper Details */}
                        <div>
                          {/* App Badge */}
                          <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black tracking-widest text-indigo-300 uppercase mb-3">
                            {appName} COIN
                          </div>

                          {/* Coins Amount */}
                          <div className="text-3xl font-extrabold text-white tracking-tight">
                            {opt.credits.toLocaleString()} 코인
                          </div>
                        </div>

                        {/* Mid-Lower Price & Tag */}
                        <div className="mt-2">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black bg-gradient-to-r from-indigo-400 via-purple-300 to-white bg-clip-text text-transparent">
                              {opt.price.toLocaleString()}원
                            </span>
                            {discountPercent > 0 && (
                              <span className="text-xs font-bold text-rose-400">
                                ({discountPercent}% 할인)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Divider Line */}
                        <div className="w-2/3 my-3 border-t border-white/10" />

                        {/* Bottom Feature badges */}
                        <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold tracking-wider">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            안전결제
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            즉시충전
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            평생유효
                          </span>
                        </div>
                      </div>

                      {/* Best Value Badge top-right */}
                      {isBestValue && (
                        <div className="absolute top-0 right-6 bg-gradient-to-b from-indigo-500 to-indigo-700 text-white font-extrabold text-[9px] px-2.5 py-1.5 rounded-b-lg shadow-[0_2px_8px_rgba(79,70,229,0.3)] flex items-center gap-1 tracking-wider uppercase">
                          <svg className="w-2.5 h-2.5 text-amber-300 fill-current" viewBox="0 0 20 20">
                            <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                          </svg>
                          BEST VALUE
                        </div>
                      )}

                      {/* Standard Discount Tag top-right (if not best value but discounted) */}
                      {!isBestValue && discountPercent > 0 && (
                        <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[9px] font-black tracking-wider animate-pulse">
                          {discountPercent}% 할인
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 결제 수단 선택 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900">2. 결제 수단 선택</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 cursor-pointer transition-all ${
                    method === 'card'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-inner'
                      : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    checked={method === 'card'}
                    onChange={() => setMethod('card')}
                    className="h-4.5 w-4.5 accent-indigo-600"
                  />
                  <span className="font-bold text-sm">신용카드</span>
                </label>
                <label
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 cursor-pointer transition-all ${
                    method === 'phone'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-inner'
                      : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    checked={method === 'phone'}
                    onChange={() => setMethod('phone')}
                    className="h-4.5 w-4.5 accent-indigo-600"
                  />
                  <span className="font-bold text-sm">휴대폰 결제</span>
                </label>
              </div>
            </div>

            {/* 결제 실행 버튼 */}
            <HubPaymentTrigger
              amount={selectedPkg.price}
              coinAmount={selectedPkg.credits}
              payMethodType={method}
              returnUrl={`${origin}/api/payment/callback`}
              onSuccess={onSuccess}
              onError={onError}
              className="w-full rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all"
            >
              {selectedOption.toLocaleString()} 코인 결제하기
            </HubPaymentTrigger>
          </div>
        )}

        {/* 이용 내역 탭 화면 */}
        {tab === 'history' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-black text-slate-900">이용 내역</h2>
            {historyLoading ? (
              <div className="flex items-center justify-center py-10">
                <svg className="animate-spin h-6 w-6 text-indigo-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm font-medium">
                이용 내역이 존재하지 않습니다.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {history.map((item) => {
                  const rawDesc = item.display_text || item.description || '';
                  let formattedDesc = rawDesc
                    .replace('(신규)', '')
                    .replace('KCP 심사관 테스트 코인 충전 (5,000C)', '코인 충전')
                    .trim();
                  if (!formattedDesc.startsWith(appName)) {
                    formattedDesc = `${appName} - ${formattedDesc}`;
                  }

                  const parts = formattedDesc.split(' - ');
                  const itemAppName = parts[0];
                  const actionAndTitle = parts.slice(1).join(' - ');

                  return (
                    <div key={item.id} className="py-3.5 group">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-bold text-slate-800 truncate flex-1 flex items-center gap-2">
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-indigo-50 text-[10px] font-black text-indigo-600 border border-indigo-100">
                            {itemAppName}
                          </span>
                          <span className="truncate">{actionAndTitle}</span>
                        </div>
                        <div
                          className={`text-sm font-black shrink-0 ${
                            Number(item.amount) > 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {Number(item.amount) > 0 ? '+' : ''}
                          {Number(item.amount || 0).toLocaleString()} C
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-[10px] font-medium text-slate-400">
                          {formatDate(item.created_at || item.createdAt)}
                        </div>
                        {typeof item.balance === 'number' && !isNaN(item.balance) && (
                          <div className="text-[10px] font-bold text-slate-300">
                            잔액 {item.balance.toLocaleString()} C
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {historyTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold border border-slate-200 disabled:opacity-30 transition-all hover:bg-slate-50"
                >
                  이전
                </button>
                <span className="text-xs text-slate-500">
                  {historyPage} / {historyTotalPages}
                </span>
                <button
                  disabled={historyPage >= historyTotalPages}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold border border-slate-200 disabled:opacity-30 transition-all hover:bg-slate-50"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}

        {/* 하단 약관 및 유의사항 */}
        <div className="rounded-xl bg-slate-100 border border-slate-200 p-5 text-xs text-slate-500 space-y-4">
          <div>
            <p className="font-bold text-slate-700 mb-1">상품정보</p>
            <p>
              본 상품은 {appName} AI 서비스를 이용할 수 있는 디지털 이용권입니다. 결제 즉시 코인이 충전되어 서비스를
              이용할 수 있습니다.
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">환불 정책 및 휴대폰 결제 안내</p>
            <p className="mb-2">
              결제 완료 시 계정으로 즉시 지급되는 무형의 디지털 재화이므로 실물 배송은 없습니다. 결제 후 7일 이내,
              이용권을 단 1회도 사용하지 않은 경우에 한하여 전액 환불 가능합니다. (일부 사용 시 잔여분 환불 불가)
            </p>
            <div className="bg-white/50 p-3 rounded-lg border border-slate-200 text-rose-600 font-medium">
              <p className="font-bold">※ 휴대폰 결제 환불 규정 (필독)</p>
              <p className="mt-1">
                휴대폰 소액결제는 당월취소만 가능하며 결제자 본인명의 계좌로 환불됩니다. (휴대폰 결제의 경우 당월은
                취소만 가능, 익월 이후 청구요금 수납 확인 후 결제자 본인 계좌 환불 가능)
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
