'use client';

/**
 * Version: v1.0.0
 * Last Updated: 2026-05-15
 */
import { useState, useEffect } from 'react';
import { MerlinHubClient } from './client';

/**
 * Hub Profile/Session 정보
 */
export interface HubSession {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: {
    id: string;
    email?: string;
    nickname?: string;
    avatar_url?: string;
    credits?: number;
  } | null;
  error: Error | null;
}

/**
 * [Core] Hub 세션 상태를 관리하는 커스텀 훅
 * 개별 앱은 이 훅을 통해 현재 유저가 허브에 로그인되어 있는지, 누구인지를 실시간으로 파악합니다.
 */
export function useHubSession() {
  const [session, setSession] = useState<HubSession>({
    isLoggedIn: false,
    isLoading: true,
    user: null,
    error: null,
  });

  const client = new MerlinHubClient();

  const refreshSession = async () => {
    try {
      setSession(prev => ({ ...prev, isLoading: true }));
      
      // 허브 API로부터 현재 유저 프로필 조회
      const profile = await client.getProfile();
      
      // profile.success가 true일 때만 로그인 상태로 간주
      if (profile && profile.success) {
        setSession({
          isLoggedIn: true,
          isLoading: false,
          user: profile as any,
          error: null,
        });
      } else {
        setSession({
          isLoggedIn: false,
          isLoading: false,
          user: null,
          error: null,
        });
      }
    } catch (err: any) {
      setSession({
        isLoggedIn: false,
        isLoading: false,
        user: null,
        error: err,
      });
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  return {
    ...session,
    refreshSession,
  };
}
