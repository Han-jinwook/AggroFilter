'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/c-app-header';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const msg = searchParams.get('msg') || '결제가 취소되었거나 처리 중 오류가 발생했습니다.';

  return (
    <div className="mx-auto max-w-[var(--app-max-width)] px-4 py-8">
      <div className="rounded-3xl border-2 border-rose-200 bg-white p-6 sm:p-8 text-center shadow-lg space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
          <AlertCircle size={36} />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            결제가 완료되지 않았습니다
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {msg}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/payment/purchase')}
            className="flex-1 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-5 text-sm font-black text-white shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={16} />
            <span>다시 시도하기</span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex-1 rounded-2xl bg-slate-100 hover:bg-slate-200 py-3.5 px-5 text-sm font-bold text-slate-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
          >
            <ArrowLeft size={16} />
            <span>홈으로 이동</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 pt-4 pb-8">
        <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-sm font-bold text-slate-400">오류 정보 확인 중...</div>}>
          <PaymentFailContent />
        </Suspense>
      </main>
    </div>
  );
}
