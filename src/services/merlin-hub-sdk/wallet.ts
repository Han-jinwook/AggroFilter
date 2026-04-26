/**
 * Merlin Hub SDK — Wallet Module
 * 통합 크레딧 차감/조회 (Idempotency Key 필수)
 */

import { hubFetch } from './client';

export interface UseCreditParams {
  amount: number;
  requestId: string;       // Idempotency Key — 중복 차감 방지
  displayText?: string;    // 원장에 표시할 설명 (예: "영상 분석 1회")
}

export interface UseCreditResult {
  success: boolean;
  balance?: number;
  error?: string;
}

export interface WalletBalance {
  balance: number;
  userId: string;
}

/**
 * 크레딧 차감 요청
 * @param params 차감 파라미터 (amount, requestId 필수)
 */
export async function useCredit(params: UseCreditParams): Promise<UseCreditResult> {
  try {
    const { ok, data } = await hubFetch<UseCreditResult>('/api/wallet/use', {
      method: 'POST',
      body: JSON.stringify({
        amount: params.amount,
        request_id: params.requestId,
        display_text: params.displayText || '크레딧 사용',
      }),
    });

    if (!ok) {
      return { success: false, error: data?.error || '크레딧 차감 실패' };
    }

    return { success: true, balance: data.balance };
  } catch (err) {
    console.error('[MerlinHub] useCredit error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * localStorage에서 userId(UUID) 조회
 */
export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const userId = localStorage.getItem('merlin_user_id');
  if (userId) return userId;

  const legacyFamilyUid = localStorage.getItem('merlin_family_uid');
  if (legacyFamilyUid) {
    localStorage.setItem('merlin_user_id', legacyFamilyUid);
    return legacyFamilyUid;
  }

  return null;
}

/**
 * 현재 크레딧 잔액 조회
 * @param userId 지정하지 않으면 localStorage에서 자동 조회
 */
export async function getBalance(userId?: string): Promise<{ success: boolean; balance?: number; error?: string }> {
  const uid = userId || getUserId();
  if (!uid) {
    return { success: false, error: '로그인이 필요합니다 (userId 없음)' };
  }

  try {
    const { ok, data } = await hubFetch<WalletBalance>(`/api/wallet/balance?userId=${encodeURIComponent(uid)}`);

    if (!ok) {
      return { success: false, error: '잔액 조회 실패' };
    }

    return { success: true, balance: data.balance };
  } catch (err) {
    console.error('[MerlinHub] getBalance error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}
