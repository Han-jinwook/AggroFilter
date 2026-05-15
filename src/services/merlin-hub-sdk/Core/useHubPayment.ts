/**
 * Version: v1.0.0
 * Last Updated: 2026-05-15
 */
import { useState, useCallback } from 'react';
import { MerlinHubClient } from './client';

export type PaymentStatus = 'idle' | 'preparing' | 'pending' | 'success' | 'error';

/**
 * [Core] Hub 결제 및 지갑 관리를 담당하는 커스텀 훅
 * KCP 결제 호출 및 결과 확인, 코인 잔액 조회 기능을 통합 제공합니다.
 */
export function useHubPayment() {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const client = new MerlinHubClient();

  /**
   * 결제창 호출 요청
   * @param planId 구매할 이용권/충전 상품 ID
   */
  const requestPayment = useCallback(async (planId: string) => {
    try {
      setStatus('preparing');
      setError(null);

      // 1. 허브 서버로부터 KCP 결제에 필요한 파라미터(Signature 등) 요청
      const paymentParams = await client.preparePayment(planId);
      
      if (!paymentParams) {
        throw new Error('결제 준비 중 오류가 발생했습니다.');
      }

      // 2. KCP 표준 결제 팝업 호출 (라이브러리에 내장된 KCP 모듈 사용)
      // 실제 구현 시 window.js_f_pay(window.order_info) 등의 호출 로직이 들어갑니다.
      setStatus('pending');
      
      return paymentParams;
    } catch (err: any) {
      setStatus('error');
      setError(err.message);
      return null;
    }
  }, []);

  /**
   * 코인 잔액 조회
   */
  const getBalance = useCallback(async () => {
    try {
      const profile = await client.getProfile();
      return profile?.credits || 0;
    } catch (err) {
      console.error('잔액 조회 실패:', err);
      return 0;
    }
  }, []);

  return {
    status,
    error,
    requestPayment,
    getBalance,
  };
}
