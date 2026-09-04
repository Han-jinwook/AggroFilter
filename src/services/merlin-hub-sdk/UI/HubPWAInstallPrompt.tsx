/**
 * Version: v2.2.0
 * Last Updated: 2026-08-31
 * Merlin Hub SDK — PWA 바로가기 추가 유도 배너 & 상시 설치 진입로 버튼
 */
'use client';

import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 모바일 기기 감지 유틸리티
const checkIsMobile = () => {
  if (typeof window === 'undefined') return false;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isMobileScreen = window.innerWidth <= 768;
  return isMobileUA && isMobileScreen;
};

// 독립 PWA 구동 여부 감지 (아이콘으로 실행 중인지)
const checkIsStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
};

// 전역 PWA 설치 이벤트 캐시
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

/**
 * 1. [상시 설치 진입로] 모바일 브라우저 전용 심플 버튼
 * (설정/마이페이지 등에 배치하여 유저가 언제든 원할 때 홈 화면에 앱을 추가할 수 있도록 지원)
 */
export function HubPWAInstallButton({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMobile(checkIsMobile());
    setIsStandalone(checkIsStandalone());
  }, []);

  if (!mounted || !isMobile || isStandalone) {
    return null; // PC 환경이거나 이미 앱(standalone)으로 실행 중이면 100% 숨김
  }

  const handleManualInstall = () => {
    window.dispatchEvent(new Event('triggerPWAInstall'));
  };

  return (
    <button
      type="button"
      onClick={handleManualInstall}
      className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-slate-800/70 border border-indigo-200/80 dark:border-slate-700 hover:bg-indigo-100/70 transition-all group cursor-pointer text-left ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center font-black shadow-xs shrink-0">
          📱
        </div>
        <div>
          <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
            홈 화면에 바로가기 추가
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
            스마트폰 홈 화면에서 터치 한 번으로 바로 열기
          </p>
        </div>
      </div>
      <span className="text-[11px] sm:text-xs font-bold text-brand-primary bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-slate-700 shadow-2xs shrink-0">
        추가 ⚡
      </span>
    </button>
  );
}

/**
 * 2. [바닥 팝업 배너] 표준 3일 락 기반 PWA 설치 유도 배너
 */
export function HubPWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  const handleInstallClick = async () => {
    // 1. 카카오톡 / 네이버 등 인앱 브라우저 탈출
    if (isInAppBrowser) {
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid) {
        const cleanHost = window.location.host;
        const cleanPath = window.location.pathname + window.location.search;
        window.location.href = `intent://${cleanHost}${cleanPath}#Intent;scheme=https;package=com.android.chrome;end`;
      } else {
        alert('카카오톡/네이버 앱 내부에서는 홈 화면 추가가 제한됩니다.\n\n우측 상단 또는 하단의 메뉴(⋮ 또는 📤)를 눌러 "Safari로 열기"를 선택해 주세요!');
      }
      setShowInstallPrompt(false);
      sessionStorage.setItem('pwa-inapp-dismissed', '1');
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
      return;
    }

    const activePrompt = deferredPrompt || globalDeferredPrompt;

    // 2. 안드로이드 크롬 / 삼성인터넷 Native PWA 원클릭 추가
    if (activePrompt) {
      activePrompt.prompt();
      const choiceResult = await activePrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('홈 화면 추가 완료');
      }
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      setShowInstallPrompt(false);
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
      return;
    }

    // 3. 네이티브 프롬프트가 미지원/대기 상태인 안드로이드 브라우저 안내
    const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      alert('홈 화면에 아이콘을 추가하려면:\n\n우측 상단 메뉴(⋮) 터치 ➔ [홈 화면에 추가 / 앱 설치]를 선택해 주세요!');
      setShowInstallPrompt(false);
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
      return;
    }

    // 4. iOS Safari 수동 홈화면 추가 안내
    const isIOSSafari = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOSSafari) {
      alert('홈 화면에 아이콘을 추가하려면:\n\n1. 하단의 공유 버튼(📤) 터치\n2. "홈 화면에 추가" 선택\n3. "추가" 버튼 터치');
      setShowInstallPrompt(false);
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    }
  };

  useEffect(() => {
    if (!checkIsMobile() || checkIsStandalone()) {
      return;
    }

    // 인앱 브라우저 감지
    const inApp = /KAKAOTALK|kakaowork|NAVER|Instagram|FB_IAB|Line/i.test(navigator.userAgent);
    setIsInAppBrowser(inApp);

    // 인앱 브라우저에서 이미 탈출 또는 닫기를 누른 경우 방어
    if (inApp && sessionStorage.getItem('pwa-inapp-dismissed') === '1') {
      return;
    }

    // 1. 일반 브라우저: 사용자가 '나중에'를 눌렀을 때 3일 동안 다시 묻지 않는 표준 톤앤매너 준수
    // (단, URL에 ?test=1, ?install=1, ?debug=1 파라미터가 있으면 즉시 테스트 가능)
    const installDismissed = localStorage.getItem('pwa-prompt-dismissed');
    const isTestMode = window.location.search.includes('t=') || window.location.search.includes('test=') || window.location.search.includes('debug=') || window.location.search.includes('install=');

    let canShowBanner = true;
    if (installDismissed && !isTestMode) {
      const dismissedTime = parseInt(installDismissed);
      const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < threeDaysInMs) {
        canShowBanner = false;
      }
    }

    // 2. 3일 락이 걸려 있지 않다면 1.5초 후 바닥 배너 노출
    let promptTimer: NodeJS.Timeout | null = null;
    if (canShowBanner) {
      promptTimer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 1500);
    }

    // 안드로이드 네이티브 PWA 설치 이벤트 수신
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      if (canShowBanner) {
        setShowInstallPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    };

    // 상시 설치 버튼 등 외부 트리거 수신
    const handleExternalTrigger = () => {
      handleInstallClick();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('triggerPWAInstall', handleExternalTrigger);

    return () => {
      if (promptTimer) clearTimeout(promptTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('triggerPWAInstall', handleExternalTrigger);
    };
  }, []);

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // 이미 설치되었거나 프롬프트를 띄우지 않는 경우
  if (isInstalled || !showInstallPrompt) {
    return null;
  }

  const isIOSSafari = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-sm">
      <div className="bg-gradient-to-b from-[#0b192c]/98 via-[#0d223a]/98 to-[#081220]/98 backdrop-blur-xl border border-sky-500/35 rounded-2xl shadow-[0_16px_40px_rgba(0,10,25,0.5)] p-4 animate-in slide-in-from-bottom-5">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-sky-500/20 border border-sky-400/30 rounded-xl flex items-center justify-center text-sky-300 shadow-inner">
              <svg className="w-5 h-5 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
              <span>{isInAppBrowser ? '홈 화면에 바로가기 추가 안내' : '홈 화면에 바로가기 추가'}</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            </p>
            <p className="text-xs text-sky-100/85 font-medium mt-0.5 leading-snug">
              {isInAppBrowser 
                ? '카카오 안에서는 홈 화면 추가가 제한됩니다. 기본 브라우저로 열어주세요!'
                : '스마트폰 앱처럼 홈 화면에서 터치 한 번으로 바로 열 수 있어요!'}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3.5 flex space-x-2">
          <button
            onClick={handleInstallClick}
            className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs sm:text-sm font-black py-2.5 px-3 rounded-xl shadow-lg shadow-sky-950/60 active:scale-[0.98] transition-all cursor-pointer"
          >
            {isInAppBrowser 
              ? '기본 브라우저로 열기 ↗' 
              : (isIOSSafari ? '추가 방법 보기 👈' : '홈 화면에 추가하기 ⚡')}
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 bg-white/10 hover:bg-white/15 text-slate-300 text-xs sm:text-sm font-bold py-2.5 px-3 rounded-xl border border-white/10 active:scale-[0.98] transition-all cursor-pointer"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
