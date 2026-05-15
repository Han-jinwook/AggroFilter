/**
 * Version: v1.0.0
 * Last Updated: 2026-05-15
 */
import { useState, useCallback } from 'react';
import { MerlinHubClient } from './client';

/**
 * [Core] Hub 추천인 시스템 및 보상 연동을 담당하는 커스텀 훅
 * 나의 추천 코드 조회 및 타인의 코드 등록 기능을 제공합니다.
 */
export function useHubReferral() {
  const [isLoading, setIsLoading] = useState(false);
  const client = new MerlinHubClient();

  /**
   * 나의 추천인 코드 및 추천 현황 조회
   */
  const getMyReferralInfo = useCallback(async () => {
    try {
      setIsLoading(true);
      const profile = await client.getProfile();
      return {
        code: profile?.referral_code || '',
        inviteCount: profile?.invite_count || 0,
        totalReward: profile?.total_referral_reward || 0,
      };
    } catch (err) {
      console.error('추천 정보 조회 실패:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 신규 가입 시 추천인 코드 등록
   * @param code 등록할 추천인 코드
   */
  const registerReferrer = useCallback(async (code: string) => {
    try {
      setIsLoading(true);
      const result = await client.registerReferrer(code);
      return result.success;
    } catch (err) {
      console.error('추천인 등록 실패:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    getMyReferralInfo,
    registerReferrer,
  };
}
