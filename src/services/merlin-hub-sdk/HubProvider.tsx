'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkSession, getBalance, getUserId } from './CoreLogic/index';
import { configureMerlinHub } from './CoreLogic/config';

interface HubUser {
  id: string;
  email: string;
  nickname?: string;
  avatar_url?: string;
  notification_settings?: any;
}

interface HubContextType {
  user: HubUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  balance: number | null;
  refreshSession: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  updateNotificationSettings: (settings: { email: boolean; smart_notification?: boolean }) => Promise<boolean>;
}

const HubContext = createContext<HubContextType | undefined>(undefined);

export function HubProvider({ children, appId }: { children: React.ReactNode; appId?: string }) {
  const [user, setUser] = useState<HubUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);

  // appId 설정 주입
  useEffect(() => {
    if (appId) {
      configureMerlinHub({ appId });
    }
  }, [appId]);

  const refreshBalance = useCallback(async () => {
    try {
      const userId = getUserId();
      if (!userId) return;
      
      const result = await getBalance(userId);
      if (result.success && typeof result.balance === 'number') {
        setBalance(result.balance);
        if (typeof window !== 'undefined') {
          localStorage.setItem('merlin_cached_balance', String(result.balance));
        }
      }
    } catch (err) {
      console.error('[HubProvider] Failed to fetch balance:', err);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      // 캐시가 존재할 때는 UI 깜빡임 방지를 위해 로딩 스켈레톤을 띄우지 않고 백그라운드 갱신합니다.
      setIsLoading(prev => {
        if (typeof window !== 'undefined') {
          return !localStorage.getItem('merlin_cached_user');
        }
        return prev;
      });
      const session = await checkSession();
      
      if (session.valid && session.email) {
        const freshUser = {
          id: session.userId || '',
          email: session.email,
          nickname: session.nickname,
          avatar_url: session.avatar_url,
          notification_settings: (session as any).notification_settings || {},
        };
        setUser(freshUser);
        setIsLoggedIn(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('merlin_cached_user', JSON.stringify(freshUser));
        }
        // 세션 확인 성공 시 잔액도 업데이트
        refreshBalance();
      } else {
        setUser(null);
        setIsLoggedIn(false);
        setBalance(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('merlin_cached_user');
          localStorage.removeItem('merlin_cached_balance');
        }
      }
    } catch (err) {
      console.error('[HubProvider] Failed to sync session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshBalance]);

  const updateNotificationSettings = useCallback(async (settings: { email: boolean; smart_notification?: boolean }) => {
    try {
      const { MerlinHubClient } = await import('./CoreLogic/client');
      const client = new MerlinHubClient();
      const result = await client.updateProfile({
        notification_settings: settings,
      });
      if (result) {
        await refreshSession();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[HubProvider] Failed to update notification settings:', err);
      return false;
    }
  }, [refreshSession]);

  // 초기 로드 및 이벤트 리스너
  useEffect(() => {
    // 1. SSR Hydration 이후 즉시 로컬 스토리지의 캐시 데이터를 읽어 UI 지연을 최소화 (SWR)
    const token = localStorage.getItem('merlin_session_token');
    if (token) {
      const cachedUser = localStorage.getItem('merlin_cached_user');
      const cachedBalance = localStorage.getItem('merlin_cached_balance');
      
      let parsedUser = null;
      let parsedBalance = null;
      
      if (cachedUser) {
        try {
          parsedUser = JSON.parse(cachedUser);
        } catch {}
      } else {
        // 백업용 fallback: 기존 어플리케이션 전역에서 쓰고 있는 userNickname/userProfileImage 사용
        const backupNickname = localStorage.getItem('userNickname');
        const backupEmail = localStorage.getItem('userEmail') || '';
        const backupAvatar = localStorage.getItem('userProfileImage') || '';
        const backupUserId = localStorage.getItem('merlin_user_id') || '';
        if (backupNickname) {
          parsedUser = {
            id: backupUserId,
            email: backupEmail,
            nickname: backupNickname,
            avatar_url: backupAvatar,
            notification_settings: {}
          };
        }
      }

      if (cachedBalance) {
        parsedBalance = parseInt(cachedBalance, 10);
      }

      if (parsedUser) {
        setUser(parsedUser);
        setIsLoggedIn(true);
        setIsLoading(false); // 캐시가 있다면 우선 로딩 스켈레톤 제거
      }
      if (parsedBalance !== null) {
        setBalance(parsedBalance);
      }
    } else {
      // 비로그인 사용자는 로딩 상태 즉시 해제 (게스트로 렌더링)
      setIsLoading(false);
    }

    // 2. 백그라운드 갱신 실행 (서버의 최신 상태와 동기화)
    refreshSession();

    // 외부 이벤트 대응 (로그인 성공, 세션 만료, 잔액 변동 등)
    const handleProfileUpdate = () => refreshSession();
    const handleCreditsUpdate = () => refreshBalance();
    const handleSessionExpired = () => {
      setUser(null);
      setIsLoggedIn(false);
      setBalance(null);
      localStorage.removeItem('merlin_cached_user');
      localStorage.removeItem('merlin_cached_balance');
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    window.addEventListener('creditsUpdated', handleCreditsUpdate);
    window.addEventListener('merlinSessionExpired', handleSessionExpired);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('creditsUpdated', handleCreditsUpdate);
      window.removeEventListener('merlinSessionExpired', handleSessionExpired);
    };
  }, [refreshSession, refreshBalance]);

  return (
    <HubContext.Provider value={{ 
      user, 
      isLoggedIn, 
      isLoading, 
      balance, 
      refreshSession, 
      refreshBalance,
      updateNotificationSettings
    }}>
      {children}
    </HubContext.Provider>
  );
}

export function useHub() {
  const context = useContext(HubContext);
  if (context === undefined) {
    throw new Error('useHub must be used within a HubProvider');
  }
  return context;
}
