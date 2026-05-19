/**
 * Version: v1.3.1
 * Last Updated: 2026-05-19
 */
import { useState, useCallback } from 'react';
import { requestKcpPayment } from './wallet';
import { getConfig } from '../CoreLogic/config';

export type PaymentStatus = 'idle' | 'preparing' | 'pending' | 'success' | 'error';

/**
 * [Core] Hub 결제 기능을 담당하는 커스텀 훅
 * KCP 표준웹 결제창 호출 및 승인 프로세스를 처리합니다.
 */
export function useHubPayment() {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  /**
   * 결제창 호출 실행
   */
  const requestPayment = useCallback(async (params: {
    amount: number;
    coinAmount: number;
    payMethodType: 'card' | 'phone' | 'bank';
    returnUrl?: string;
  }) => {
    try {
      setStatus('preparing');
      setError(null);

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
      const siteCd = orderData.site_cd || '';

      // 2. KCP 표준결제 JS 스크립트 동적 로드 (site_cd에 맞춰 테스트/운영 분기)
      const isTest = siteCd.startsWith('T') || siteCd === 'ALRJ8' || siteCd.startsWith('A') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const targetSrc = isTest 
        ? 'https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js'
        : 'https://spay.kcp.co.kr/plugin/kcp_spay_hub.js';

      await new Promise<void>((resolve, reject) => {
        if (typeof window === 'undefined') {
          resolve();
          return;
        }

        const existing = document.getElementById('kcp-payplus-sdk') as HTMLScriptElement;
        if (existing) {
          if (existing.src === targetSrc) {
            resolve();
            return;
          }
          existing.remove();
        }

        const script = document.createElement('script');
        script.id = 'kcp-payplus-sdk';
        script.src = targetSrc;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('KCP 결제 스크립트 로드에 실패했습니다.'));
        document.head.appendChild(script);
      });

      setStatus('pending');

      // 3. 동적 히든 폼 생성
      const formId = 'merlin_kcp_form_' + Date.now();
      let form = document.getElementById(formId) as HTMLFormElement;
      if (!form) {
        form = document.createElement('form');
        form.id = formId;
        form.method = 'POST';
        form.action = `${config.hubUrl}/api/payment/callback`;
        form.style.display = 'none';
        document.body.appendChild(form);
      } else {
        form.action = `${config.hubUrl}/api/payment/callback`;
      }

      // 폼 필드 채우기
      const fields: Record<string, string> = {
        site_cd: siteCd,
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
        // KCP 표준웹 인증 완료 시 채워질 숨김 필드 정의
        res_cd: '',
        res_msg: '',
        enc_info: '',
        enc_data: '',
        tran_cd: ''
      };

      form.innerHTML = '';
      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      // 4. 글로벌 인증 완료 콜백 등록 (KCP 표준웹 callback 규격 필수)
      (window as any).m_Completepayment = (FormOrJson: any, closeEvent: any) => {
        try {
          const res_cd = FormOrJson.elements["res_cd"]?.value || "";
          const res_msg = FormOrJson.elements["res_msg"]?.value || "";
          const enc_info = FormOrJson.elements["enc_info"]?.value || "";
          const enc_data = FormOrJson.elements["enc_data"]?.value || "";
          const tran_cd = FormOrJson.elements["tran_cd"]?.value || "";

          const formElement = document.getElementById(formId) as HTMLFormElement;
          if (formElement) {
            const setVal = (name: string, val: string) => {
              let input = formElement.querySelector(`input[name="${name}"]`) as HTMLInputElement;
              if (!input) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                formElement.appendChild(input);
              }
              input.value = val;
            };

            setVal("res_cd", res_cd);
            setVal("res_msg", res_msg);
            setVal("enc_info", enc_info);
            setVal("enc_data", enc_data);
            setVal("tran_cd", tran_cd);

            if (res_cd === "0000") {
              formElement.submit();
            } else {
              if (closeEvent) closeEvent();
              setError(`[${res_cd}] ${res_msg}`);
              setStatus('error');
            }
          }
        } catch (e: any) {
          console.error('[KCP Callback Error]', e);
          if (closeEvent) closeEvent();
          setError(e.message);
          setStatus('error');
        }
      };

      // 5. KCP 표준웹 결제창 실행
      setTimeout(() => {
        try {
          const kcpExecute = (window as any).KCP_Pay_Execute_Web;
          if (typeof kcpExecute === 'function') {
            kcpExecute(form);
          } else {
            throw new Error('KCP 실행 함수(KCP_Pay_Execute_Web)를 찾을 수 없습니다.');
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
  }, []);

  /**
   * 코인 잔액 조회
   */
  const getBalance = useCallback(async () => {
    const { getProfile } = await import('../Auth/auth');
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
    isReady: true
  };
}
