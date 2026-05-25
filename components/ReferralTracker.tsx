'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function ReferralTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams?.get('ref');
    if (ref && typeof window !== 'undefined') {
      localStorage.setItem('userReferralCode', ref);
      console.log('[ReferralTracker] Captured referral code from URL:', ref);
    }
  }, [searchParams]);

  return null; // UI를 렌더링하지 않는 유틸성 컴포넌트
}
