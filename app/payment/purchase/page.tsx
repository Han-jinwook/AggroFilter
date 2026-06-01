'use client';

import { Suspense } from 'react';
import { AppHeader } from '@/components/c-app-header';
import { HubPurchaseWidget } from '@/src/services/merlin-hub-sdk/react';

export default function PurchasePaymentPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 pt-4 pb-8">
        <div className="mx-auto max-w-[var(--app-max-width)] px-4">
          <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
            <HubPurchaseWidget appName="어그로필터" redirectUrl="/" />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

