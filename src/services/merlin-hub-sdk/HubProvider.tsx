'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkSession, getBalance, getUserId, getSessionToken, setSessionToken, clearSessionToken } from './CoreLogic/index';
import { configureMerlinHub } from './CoreLogic/config';
import { HubOfflineBanner } from './UI/HubOfflineBanner';

interface HubUser {
  id: string;
  email: string;
  nickname?: string;
  avatar_url?: string;
  profile_image?: string;
  referral_code?: string;
  notification_settings?: any;
  registered_apps?: string[];
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
          referral_code: session.referral_code,
          notification_settings: (session as any).notification_settings || {},
          registered_apps: (session as any).registered_apps || [],
        };
        setUser(freshUser);
        setIsLoggedIn(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('merlin_cached_user', JSON.stringify(freshUser));
          if (freshUser.id) {
            localStorage.setItem('merlin_user_id', freshUser.id);
          }
          if (freshUser.email) {
            localStorage.setItem('userEmail', freshUser.email);
          }
          if (freshUser.referral_code) {
            localStorage.setItem('userReferralCode', freshUser.referral_code);
          }
          window.dispatchEvent(new CustomEvent('merlinLoggedIn', { detail: freshUser }));
        }
        // 세션 확인 성공 시 잔액도 업데이트
        refreshBalance();
      } else if (session.status === 401 || session.status === 403) {
        // 서버의 명시적인 인증 거부(401/403)일 때만 세션 클리어
        setUser(null);
        setIsLoggedIn(false);
        setBalance(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('merlin_cached_user');
          localStorage.removeItem('merlin_cached_balance');
          localStorage.removeItem('userReferralCode');
        }
      }
      // 일시적인 네트워크 오류(status 0, 502 등)일 때는 기존 캐시된 로그인 상태를 유지!
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
    // 🚀 안드로이드 카카오톡 감지 시 크롬 외부 브라우저로 원활한 즉시 탈출 (세션 격리 및 PWA 설치 불가 원천 방지)
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent || '';
      const isAndroid = /Android/i.test(userAgent);
      const isKakao = /KAKAOTALK|kakaowork/i.test(userAgent);
      const hasEscaped = sessionStorage.getItem('kakaotalk_inapp_escaped');

      if (isAndroid && isKakao && !hasEscaped) {
        sessionStorage.setItem('kakaotalk_inapp_escaped', '1');
        const cleanHost = window.location.host;
        const cleanPath = window.location.pathname + window.location.search;
        window.location.href = `intent://${cleanHost}${cleanPath}#Intent;scheme=https;package=com.android.chrome;end`;
        return;
      }

      // URL에서 ref / r / referral (추천인 코드) 파라미터 파싱하여 로컬 스토리지에 저장
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref') || urlParams.get('r') || urlParams.get('referral');
      if (refCode) {
        localStorage.setItem('pendingReferralCode', refCode);
        console.log('[HubProvider] Detected and saved pending referral code:', refCode);
      }

      // SSO (Single Sign-On) 토큰 파싱: F 아이콘 앱 스위처를 통해 넘어올 때 로그인 상태 유지
      const ssoToken = urlParams.get('token');
      if (ssoToken) {
        setSessionToken(ssoToken);
        console.log('[HubProvider] Detected SSO token, saving to session and domain cookie');
        
        // 보안 및 깔끔한 URL을 위해 주소창에서 token 파라미터 제거
        urlParams.delete('token');
        const searchStr = urlParams.toString();
        const newUrl = window.location.pathname + (searchStr ? '?' + searchStr : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    }

    // 1. SSR Hydration 이후 즉시 로컬 스토리지/공용 쿠키의 세션 토큰을 확인 (SWR)
    const token = getSessionToken();
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
      clearSessionToken('local');
      localStorage.removeItem('merlin_cached_user');
      localStorage.removeItem('merlin_cached_balance');
    };

    // 3. 멀티 탭 실시간 동기화: 다른 탭에서 로그인/로그아웃하거나 탭 활성화 시 세션 갱신 (5분 스마트 스로틀링)
    let lastCheckTime = Date.now();
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const currentToken = getSessionToken();
        const now = Date.now();
        if (currentToken) {
          // 탭 전환 시 과도한 API 연타 방지: 최소 5분(300,000ms) 경과 시에만 백그라운드 갱신
          if (now - lastCheckTime > 5 * 60 * 1000) {
            lastCheckTime = now;
            refreshSession();
          }
        } else if (isLoggedIn) {
          // 🚨 Local Token Shield: 이 앱 자체의 로컬스토리지에 토큰이 살아있다면, 타 앱 로그아웃이나 쿠키 변동으로 세션을 죽이지 않음!
          const localToken = typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') : null;
          if (!localToken) {
            handleSessionExpired();
          }
        }
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'merlin_session_token' || e.key === 'merlin_cached_user') {
        refreshSession();
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    window.addEventListener('creditsUpdated', handleCreditsUpdate);
    window.addEventListener('merlinSessionExpired', handleSessionExpired);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('creditsUpdated', handleCreditsUpdate);
      window.removeEventListener('merlinSessionExpired', handleSessionExpired);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refreshSession, refreshBalance, isLoggedIn]);

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
      <HubOfflineBanner />
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
