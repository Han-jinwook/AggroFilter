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
                  return (
                    <button
                      key={opt.credits}
                      onClick={() => setSelectedOption(opt.credits)}
                      className={`relative flex flex-col justify-between text-left rounded-2xl p-5 min-h-[160px] bg-gradient-to-br ${
                        opt.gradient
                      } text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-xl shadow-md ${
                        isSelected ? 'ring-4 ring-indigo-600 scale-[1.02]' : ''
                      }`}
                    >
                      {/* 할인 배지 */}
                      {opt.discount > 0 && (
                        <span className="absolute top-3.5 right-3.5 px-2 py-0.5 rounded-full bg-rose-500 text-[10px] font-black uppercase tracking-wider shadow-sm animate-pulse">
                          {opt.discount}% 할인
                        </span>
                      )}

                      {/* 상단 코인 정보 */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-black tracking-widest text-indigo-300 uppercase">
                          {appName} COIN
                        </span>
                        <div className="text-2xl font-black">{opt.credits.toLocaleString()} 코인</div>
                      </div>

                      {/* 하단 가격 및 간단 설명 */}
                      <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-baseline">
                        <div className="text-xs text-white/60 font-medium">안전결제 · 즉시충전</div>
                        <div className="text-lg font-black text-amber-300">{opt.price.toLocaleString()}원</div>
                      </div>
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
