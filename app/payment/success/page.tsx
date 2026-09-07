'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/c-app-header';
import { useHub } from '@/src/services/merlin-hub-sdk/react';
import { CheckCircle2, ArrowRight, Coins, History } from 'lucide-react';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { balance } = useHub();

  const orderId = searchParams.get('order_id') || '';
  const redirectUrl = searchParams.get('redirectUrl') || '/';

  return (
    <div className="mx-auto max-w-[var(--app-max-width)] px-4 py-8">
      <div className="rounded-3xl border-2 border-emerald-200 bg-white p-6 sm:p-8 text-center shadow-lg space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
          <CheckCircle2 size={36} />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            코인 충전이 완료되었습니다!
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            정상적으로 승인되어 계정에 코인이 즉시 지급되었습니다.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 sm:p-5 space-y-3 text-left">
          {orderId && (
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-500 font-medium">주문 번호</span>
              <span className="font-mono font-bold text-slate-800 text-[11px] sm:text-xs">
                {orderId}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-slate-200/60">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Coins size={15} className="text-amber-500" />
              현재 보유 코인
            </span>
            <span className="text-base sm:text-lg font-black text-amber-600">
              {typeof balance === 'number' ? `${balance.toLocaleString()} C` : '확인 중...'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push(redirectUrl)}
            className="flex-1 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-5 text-sm font-black text-white shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>어그로필터 이용하기</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={() => router.push('/payment/purchase?tab=history')}
            className="flex-1 rounded-2xl bg-slate-100 hover:bg-slate-200 py-3.5 px-5 text-sm font-bold text-slate-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
          >
            <History size={16} />
            <span>이용 내역 보기</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 pt-4 pb-8">
        <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-sm font-bold text-slate-400">결제 정보 확인 중...</div>}>
          <PaymentSuccessContent />
        </Suspense>
      </main>
    </div>
  );
}
