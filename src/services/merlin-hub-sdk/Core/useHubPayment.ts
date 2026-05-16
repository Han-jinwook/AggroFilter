/**
 * Version: v1.2.0
 * Last Updated: 2026-05-16
 */
import { useState, useCallback, useEffect } from 'react';
import { requestKcpPayment } from './wallet';
import { getConfig } from './config';

export type PaymentStatus = 'idle' | 'preparing' | 'pending' | 'success' | 'error';

/**
 * [Core] Hub 결제 기능을 담당하는 커스텀 훅
 * KCP 스크립트 로드부터 결제창 호출까지의 전 과정을 자동화합니다.
 */
export function useHubPayment() {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // 1. KCP 스크립트 자동 주입
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.getElementById('kcp-payplus-sdk')) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'kcp-payplus-sdk';
    script.src = 'https://pay.kcp.co.kr/plugin/payplus_web.jsp';
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => setError('KCP 결제 모듈 로드에 실패했습니다.');
    document.head.appendChild(script);
  }, []);

  /**
   * 결제창 호출 실행
   */
  const requestPayment = useCallback(async (params: {
    amount: number;
    coinAmount: number;
    payMethodType: 'card' | 'phone';
    returnUrl?: string;
  }) => {
    try {
      setStatus('preparing');
      setError(null);

      if (!isScriptLoaded && typeof window.js_f_pay !== 'function') {
        throw new Error('결제 모듈이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      }

      const config = getConfig();
      const returnUrl = params.returnUrl || window.location.origin;

      // 1. 허브 서버로부터 결제 데이터(Signature 등) 수령
      const res = await requestKcpPayment({
        amount: params.amount,
        coinAmount: params.coinAmount,
        payMethodType: params.payMethodType,
        returnUrl: returnUrl,
      });

      if (!res.success || !res.paymentData) {
        throw new Error(res.error || '결제 준비 중 오류가 발생했습니다.');
      }

      const orderData = res.paymentData;
      setStatus('pending');

      // 2. 동적 히든 폼 생성 및 제출
      const formId = 'merlin_kcp_form_' + Date.now();
      let form = document.getElementById(formId) as HTMLFormElement;
      
      if (!form) {
        form = document.createElement('form');
        form.id = formId;
        form.method = 'POST';
        form.style.display = 'none';
        document.body.appendChild(form);
      }

      // 폼 필드 채우기
      const fields: Record<string, string> = {
        site_cd: orderData.site_cd || '',
        ordr_idxx: orderData.ordr_idxx || '',
        good_mny: String(orderData.good_mny || ''),
        good_name: orderData.good_name || '',
        buyr_name: orderData.buyr_name || '',
        buyr_mail: orderData.buyr_mail || '',
        site_name: orderData.site_name || '',
        pay_method: orderData.pay_method || '',
        req_tx: 'pay',
        currency: 'WON',
        param_opt_1: returnUrl,
        Ret_URL: `${config.hubUrl}/api/payment/callback`,
      };

      form.innerHTML = ''; // 초기화
      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      // 3. KCP 결제창 호출
      setTimeout(() => {
        try {
          if (typeof window.js_f_pay === 'function') {
            window.js_f_pay(formId);
          } else {
            throw new Error('KCP 실행 함수(js_f_pay)를 찾을 수 없습니다.');
          }
        } catch (e: any) {
          setError(e.message);
          setStatus('error');
        }
      }, 100);

      return true;
    } catch (err: any) {
      setStatus('error');
      setError(err.message);
      return false;
    }
  }, [isScriptLoaded]);

  /**
   * 코인 잔액 조회
   */
  const getBalance = useCallback(async () => {
    const { getProfile } = await import('./auth');
    try {
      const profile = await getProfile();
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
    isReady: isScriptLoaded
  };
}
