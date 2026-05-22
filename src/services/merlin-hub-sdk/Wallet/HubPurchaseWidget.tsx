/**
 * Version: v1.1.0
 * Last Updated: 2026-05-23
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
  theme?: 'modern' | 'cyber' | 'glass';
}

export const HubPurchaseWidget: React.FC<HubPurchaseWidgetProps> = ({
  appName = '어그로필터',
  redirectUrl = '/',
  onSuccess,
  onError,
  theme = 'modern',
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectUrlParam = searchParams.get('redirectUrl') || redirectUrl;
  const targetRedirectUrl = redirectUrlParam.startsWith('/') ? redirectUrlParam : '/';

  const [demoTheme, setDemoTheme] = useState<'modern' | 'cyber' | 'glass'>(theme);
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
      { credits: 1000, price: 1000, discount: 0, imgSrc: '/hub_assets/card_1000.jpg' },
      { credits: 5000, price: 4750, discount: 5, imgSrc: '/hub_assets/card_5000.png' },
      { credits: 10000, price: 9000, discount: 10, imgSrc: '/hub_assets/card_10000.jpg' },
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

  // 3대 테마 스타일 정의
  const themeStyles = useMemo(() => {
    return {
      modern: {
        container: "min-h-screen bg-slate-50 text-slate-800 font-sans transition-colors duration-300",
        card: "rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-md transition-all",
        subCard: "rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all",
        textTitle: "text-slate-900 font-extrabold",
        textMuted: "text-slate-500 font-medium",
        textPrice: "text-slate-900 font-black",
        balanceNum: "text-indigo-600 font-black",
        tabContainer: "bg-slate-200/60 p-1.5 border border-slate-300 rounded-2xl flex gap-1",
        tabActive: "flex-1 rounded-xl py-2.5 text-sm font-bold bg-white text-indigo-600 shadow-md border border-slate-200/50",
        tabInactive: "flex-1 rounded-xl py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-white/40 transition-colors",
        productActive: "ring-4 ring-indigo-600 scale-[1.03] shadow-indigo-100 shadow-xl",
        productInactive: "border-2 border-slate-200 hover:border-indigo-400 hover:scale-[1.01]",
        methodActive: "flex items-center justify-center gap-2 rounded-xl border-2 py-4 cursor-pointer transition-all border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm font-extrabold",
        methodInactive: "flex items-center justify-center gap-2 rounded-xl border-2 py-4 cursor-pointer transition-all border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 font-bold",
        historyItem: "border-b border-slate-100 py-3.5 hover:bg-slate-50/50 px-2 rounded-lg transition-colors",
        historyTag: "bg-indigo-50 text-indigo-600 border border-indigo-100",
        footerBg: "bg-slate-100 border-2 border-slate-200 text-slate-500",
        footerTitle: "text-slate-700 font-bold",
        footerCodeBox: "bg-white p-3 rounded-lg border border-slate-200 text-rose-600 font-medium",
        btnHome: "bg-white border-2 border-slate-200 text-slate-700 shadow-sm hover:border-slate-300 hover:shadow-md active:scale-95",
        payBtn: "w-full rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:shadow-xl active:scale-[0.98] transition-all border-b-4 border-indigo-850"
      },
      cyber: {
        container: "min-h-screen bg-[#030712] text-slate-100 font-sans transition-colors duration-300 dark selection:bg-cyan-500 selection:text-black",
        card: "rounded-2xl border-2 border-indigo-500/20 bg-slate-900/60 p-6 shadow-[0_0_20px_rgba(99,102,241,0.15)] backdrop-blur-md transition-all hover:border-indigo-500/40",
        subCard: "rounded-xl border border-indigo-500/20 bg-slate-950/50 p-4 transition-all",
        textTitle: "text-cyan-400 font-black tracking-wide uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]",
        textMuted: "text-slate-400 font-medium",
        textPrice: "text-white font-extrabold",
        balanceNum: "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 font-black drop-shadow-[0_0_10px_rgba(34,211,238,0.2)]",
        tabContainer: "bg-slate-950 p-1.5 border border-indigo-950/60 rounded-2xl flex gap-1",
        tabActive: "flex-1 rounded-xl py-2.5 text-sm font-bold bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] border border-indigo-400/50",
        tabInactive: "flex-1 rounded-xl py-2.5 text-sm font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-colors",
        productActive: "ring-4 ring-cyan-500 border-2 border-cyan-400 scale-[1.03] shadow-[0_0_25px_rgba(34,211,238,0.4)]",
        productInactive: "border-2 border-indigo-950 hover:border-indigo-500/30 hover:scale-[1.01] opacity-75 hover:opacity-100",
        methodActive: "flex items-center justify-center gap-2 rounded-xl border-2 py-4 cursor-pointer transition-all border-cyan-400 bg-cyan-950/30 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.2)] font-extrabold",
        methodInactive: "flex items-center justify-center gap-2 rounded-xl border-2 py-4 cursor-pointer transition-all border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 text-slate-400 font-bold",
        historyItem: "border-b border-indigo-950/40 py-3.5 hover:bg-slate-900/20 px-2 rounded-lg transition-colors",
        historyTag: "bg-cyan-950/50 text-cyan-400 border border-cyan-500/20",
        footerBg: "bg-slate-900/80 border-2 border-indigo-500/20 text-slate-400",
        footerTitle: "text-cyan-400 font-bold drop-shadow-[0_0_6px_rgba(34,211,238,0.2)]",
        footerCodeBox: "bg-slate-950/80 p-3 rounded-lg border border-red-500/20 text-rose-400 font-medium shadow-inner",
        btnHome: "bg-slate-900 border-2 border-indigo-500/30 text-cyan-400 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(34,211,238,0.2)] active:scale-95",
        payBtn: "w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 py-5 text-lg font-black text-white shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:brightness-110 active:scale-[0.98] transition-all border border-cyan-400/30 animate-glow-pulse"
      },
      glass: {
        container: "min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 font-sans transition-colors duration-300 dark selection:bg-amber-400 selection:text-black",
        card: "rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl transition-all hover:bg-white/10 hover:border-white/15",
        subCard: "rounded-xl border border-white/5 bg-white/5 p-4 transition-all",
        textTitle: "text-amber-400 font-extrabold tracking-wider drop-shadow-sm",
        textMuted: "text-slate-300 font-medium",
        textPrice: "text-white font-bold",
        balanceNum: "text-amber-400 font-black drop-shadow-md",
        tabContainer: "bg-white/5 p-1.5 border border-white/10 backdrop-blur-md rounded-2xl flex gap-1",
        tabActive: "flex-1 rounded-xl py-2.5 text-sm font-bold bg-white/15 text-white shadow-lg border border-white/20 backdrop-blur-md",
        tabInactive: "flex-1 rounded-xl py-2.5 text-sm font-bold text-slate-300/70 hover:text-white hover:bg-white/5 transition-colors",
        productActive: "ring-4 ring-amber-500 border border-amber-400 scale-[1.03] shadow-[0_0_25px_rgba(245,158,11,0.3)]",
        productInactive: "border border-white/15 hover:border-white/30 hover:scale-[1.01]",
        methodActive: "flex items-center justify-center gap-2 rounded-xl border-2 py-4 cursor-pointer transition-all border-amber-500/80 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] font-extrabold",
        methodInactive: "flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-slate-300 font-bold",
        historyItem: "border-b border-white/5 py-3.5 hover:bg-white/5 px-2 rounded-lg transition-colors",
        historyTag: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        footerBg: "bg-white/5 border border-white/10 text-slate-300",
        footerTitle: "text-amber-400 font-bold",
        footerCodeBox: "bg-black/40 p-3 rounded-lg border border-red-500/30 text-rose-300 font-medium",
        btnHome: "bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95",
        payBtn: "w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-5 text-lg font-black text-slate-950 shadow-lg shadow-amber-500/10 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] border border-amber-400/40 transition-all"
      }
    };
  }, []);

  const st = themeStyles[demoTheme];
  const config = getConfig();

  return (
    <div className={st.container}>
      <main className="mx-auto max-w-[var(--app-max-width,720px)] px-4 py-8 space-y-4">
        {/* 상단 네비게이션 */}
        <div className="flex items-center justify-start pb-2">
          <button
            onClick={() => router.push(targetRedirectUrl)}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95 group ${st.btnHome}`}
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            홈으로 돌아가기
          </button>
        </div>

        {/* 시안 데모 셀렉터 */}
        <div className={`rounded-xl border p-3 flex flex-col sm:flex-row items-center justify-between gap-3 ${
          demoTheme === 'modern' 
            ? 'bg-slate-100 border-slate-300' 
            : demoTheme === 'cyber'
              ? 'bg-indigo-950/20 border-indigo-500/30'
              : 'bg-white/5 border-white/10 backdrop-blur-md'
        }`}>
          <span className={`text-xs font-black tracking-wider uppercase ${
            demoTheme === 'modern' ? 'text-slate-700' : demoTheme === 'cyber' ? 'text-cyan-400' : 'text-amber-400'
          }`}>
            🎨 SDK PREMIUM THEME SELECTOR
          </span>
          <div className="flex gap-1.5 text-xs">
            {(['modern', 'cyber', 'glass'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDemoTheme(t)}
                className={`px-3 py-1.5 rounded-lg font-black transition-all active:scale-95 ${
                  demoTheme === t
                    ? t === 'modern'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : t === 'cyber'
                        ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                        : 'bg-amber-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                    : demoTheme === 'modern'
                      ? 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                      : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'
                }`}
              >
                {t === 'modern' ? '1. 모던 인디고' : t === 'cyber' ? '2. 네온 사이버' : '3. 프리미엄 글래스'}
              </button>
            ))}
          </div>
        </div>

        {/* 잔액 표시 영역 */}
        <div className={st.card}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-xs ${st.textMuted}`}>{nickname || '(로그인 필요)'}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-3xl ${st.balanceNum}`}>
                  {balance !== null ? balance.toLocaleString() : '…'}
                </span>
                <span className={`text-sm font-bold ${st.textMuted}`}>C</span>
              </div>
            </div>
            <div className="text-4xl drop-shadow-md">💰</div>
          </div>
        </div>

        {/* 탭 전환 영역 */}
        <div className={st.tabContainer}>
          <button
            onClick={() => setTab('charge')}
            className={tab === 'charge' ? st.tabActive : st.tabInactive}
          >
            충전하기
          </button>
          <button
            onClick={() => setTab('history')}
            className={tab === 'history' ? st.tabActive : st.tabInactive}
          >
            이용 내역
          </button>
        </div>

        {/* 충전 탭 화면 */}
        {tab === 'charge' && (
          <div className="space-y-4">
            {/* 상품 선택 */}
            <div className={st.card}>
              <h2 className={`text-base mb-5 ${st.textTitle}`}>1. 이용권 상품 선택</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {options.map((opt) => {
                  const isSelected = selectedOption === opt.credits;
                  return (
                    <button
                      key={opt.credits}
                      onClick={() => setSelectedOption(opt.credits)}
                      className={`relative rounded-2xl overflow-hidden transition-all hover:scale-[1.03] shadow-lg ${
                        isSelected ? st.productActive : st.productInactive
                      }`}
                    >
                      <img src={opt.imgSrc} alt={`${opt.credits} Coins`} className="w-full h-auto" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 결제 수단 선택 */}
            <div className={st.card}>
              <h2 className={`text-base ${st.textTitle}`}>2. 결제 수단 선택</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label
                  className={method === 'card' ? st.methodActive : st.methodInactive}
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
                  className={method === 'phone' ? st.methodActive : st.methodInactive}
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
              returnUrl={`${origin}/api/payment/callback?redirectUrl=${encodeURIComponent(targetRedirectUrl)}`}
              onSuccess={onSuccess}
              onError={onError}
              className={st.payBtn}
            >
              {selectedOption.toLocaleString()} 코인 결제하기
            </HubPaymentTrigger>
          </div>
        )}

        {/* 이용 내역 탭 화면 */}
        {tab === 'history' && (
          <div className={st.card}>
            <h2 className={`text-base ${st.textTitle}`}>이용 내역</h2>
            {historyLoading ? (
              <div className="flex items-center justify-center py-10">
                <svg className={`animate-spin h-6 w-6 ${demoTheme === 'modern' ? 'text-indigo-600' : demoTheme === 'cyber' ? 'text-cyan-400' : 'text-amber-400'}`} viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : history.length === 0 ? (
              <div className={`text-center py-10 text-sm font-medium ${st.textMuted}`}>
                이용 내역이 존재하지 않습니다.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100/10">
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
                    <div key={item.id} className={st.historyItem}>
                      <div className="flex items-center justify-between gap-4">
                        <div className={`text-sm font-bold truncate flex-1 flex items-center gap-2 ${demoTheme === 'modern' ? 'text-slate-800' : 'text-slate-200'}`}>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${st.historyTag}`}>
                            {itemAppName}
                          </span>
                          <span className="truncate">{actionAndTitle}</span>
                        </div>
                        <div
                          className={`text-sm font-black shrink-0 ${
                            Number(item.amount) > 0 
                              ? demoTheme === 'cyber' ? 'text-cyan-400' : 'text-emerald-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {Number(item.amount) > 0 ? '+' : ''}
                          {Number(item.amount || 0).toLocaleString()} C
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className={`text-[10px] font-medium ${st.textMuted}`}>
                          {formatDate(item.created_at || item.createdAt)}
                        </div>
                        {typeof item.balance === 'number' && !isNaN(item.balance) && (
                          <div className={`text-[10px] font-bold ${demoTheme === 'modern' ? 'text-slate-400' : 'text-slate-500'}`}>
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
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold border disabled:opacity-30 transition-all ${
                    demoTheme === 'modern'
                      ? 'border-slate-200 hover:bg-slate-50 text-slate-700 bg-white'
                      : demoTheme === 'cyber'
                        ? 'border-indigo-500/20 bg-slate-900/40 hover:bg-slate-850 hover:border-indigo-500/40 text-cyan-400'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                  }`}
                >
                  이전
                </button>
                <span className={`text-xs ${st.textMuted}`}>
                  {historyPage} / {historyTotalPages}
                </span>
                <button
                  disabled={historyPage >= historyTotalPages}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold border disabled:opacity-30 transition-all ${
                    demoTheme === 'modern'
                      ? 'border-slate-200 hover:bg-slate-50 text-slate-700 bg-white'
                      : demoTheme === 'cyber'
                        ? 'border-indigo-500/20 bg-slate-900/40 hover:bg-slate-850 hover:border-indigo-500/40 text-cyan-400'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                  }`}
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}

        {/* 하단 약관 및 유의사항 */}
        <div className={`rounded-xl p-5 text-xs space-y-4 ${st.footerBg}`}>
          <div>
            <p className={`mb-1 ${st.footerTitle}`}>상품정보</p>
            <p>
              본 상품은 {appName} AI 서비스를 이용할 수 있는 디지털 이용권입니다. 결제 즉시 코인이 충전되어 서비스를
              이용할 수 있습니다.
            </p>
          </div>
          <div>
            <p className={`mb-1 ${st.footerTitle}`}>환불 정책 및 휴대폰 결제 안내</p>
            <p className="mb-2">
              결제 완료 시 계정으로 즉시 지급되는 무형의 디지털 재화이므로 실물 배송은 없습니다. 결제 후 7일 이내,
              이용권을 단 1회도 사용하지 않은 경우에 한하여 전액 환불 가능합니다. (일부 사용 시 잔여분 환불 불가)
            </p>
            <div className={st.footerCodeBox}>
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
