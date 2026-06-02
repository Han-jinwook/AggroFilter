'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkSession, getBalance, getUserId } from './CoreLogic/index';
import { configureMerlinHub } from './CoreLogic/config';
import { MerlinHubClient } from './CoreLogic/client';

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
  unreadCount: number;
  refreshSession: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const HubContext = createContext<HubContextType | undefined>(undefined);

export function HubProvider({ children, appId }: { children: React.ReactNode; appId?: string }) {
  const [user, setUser] = useState<HubUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

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
      }
    } catch (err) {
      console.error('[HubProvider] Failed to fetch balance:', err);
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const client = new MerlinHubClient();
      const count = await client.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('[HubProvider] Failed to fetch unread count:', err);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const session = await checkSession();
      
      if (session.valid && session.email) {
        setUser({
          id: session.userId || '',
          email: session.email,
          nickname: session.nickname,
          avatar_url: session.avatar_url,
          notification_settings: (session as any).notification_settings || {},
        });
        setIsLoggedIn(true);
        // 세션 확인 성공 시 잔액 및 안 읽은 알림 개수 업데이트
        refreshBalance();
        refreshUnreadCount();
      } else {
        setUser(null);
        setIsLoggedIn(false);
        setBalance(null);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('[HubProvider] Failed to sync session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshBalance, refreshUnreadCount]);

  // 안 읽은 알림 30초 폴링
  useEffect(() => {
    if (!isLoggedIn) return;
    refreshUnreadCount();

    const timer = setInterval(() => {
      refreshUnreadCount();
    }, 30000);

    return () => clearInterval(timer);
  }, [isLoggedIn, refreshUnreadCount]);

  // 초기 로드 및 이벤트 리스너
  useEffect(() => {
    refreshSession();

    // 외부 이벤트 대응 (로그인 성공, 세션 만료, 잔액 변동 등)
    const handleProfileUpdate = () => refreshSession();
    const handleCreditsUpdate = () => refreshBalance();
    const handleSessionExpired = () => {
      setUser(null);
      setIsLoggedIn(false);
      setBalance(null);
      setUnreadCount(0);
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
      unreadCount,
      refreshSession, 
      refreshBalance,
      refreshUnreadCount
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
