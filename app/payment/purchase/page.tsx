'use client';

import { Suspense } from 'react';
import { HubPurchaseWidget } from '@/src/services/merlin-hub-sdk/react';

export default function PurchasePaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <HubPurchaseWidget appName="어그로필터" redirectUrl="/" />
    </Suspense>
  );
}
