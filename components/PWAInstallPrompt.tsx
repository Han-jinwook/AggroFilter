'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 모바일 기기 여부 확인 (PC/데스크톱에서는 설치 권장 안내를 띄우지 않음)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      return;
    }

    // PWA가 이미 설치되었는지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // iOS Safari 체크
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // beforeinstallprompt 이벤트 리스너 (Android Chrome 등)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // 로컬스토리지 확인 후 표시 (최근 거절 시 7일 동안 표시하지 않음)
      const installDismissed = localStorage.getItem('pwa-install-dismissed');
      if (installDismissed) {
        const dismissedTime = parseInt(installDismissed);
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < sevenDaysInMs) {
          return;
        }
      }
      
      setShowInstallPrompt(true);
    };

    // appinstalled 이벤트 리스너
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // iOS Safari의 경우 로컬스토리지 확인 후 프롬프트 표시 (3초 후)
    if (isIOSSafari) {
      const installDismissed = localStorage.getItem('pwa-install-dismissed');
      if (installDismissed) {
        const dismissedTime = parseInt(installDismissed);
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < sevenDaysInMs) {
          return;
        }
      }
      
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Android Chrome 등의 경우
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('사용자가 PWA 설치를 수락했습니다');
      } else {
        console.log('사용자가 PWA 설치를 거부했습니다');
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } else if (isIOSSafari) {
      // iOS Safari의 경우 수동 안내
      alert('홈 화면에 아이콘을 추가하려면:\n\n1. 하단의 공유 버튼(📤) 터치\n2. "홈 화면에 추가" 선택\n3. "추가" 버튼 터치');
      setShowInstallPrompt(false);
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // iOS Safari 감지
  const isIOSSafari = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  
  // 이미 설치되었거나 설치 프롬프트를 보여주지 않는 경우
  if (isInstalled || !showInstallPrompt) {
    return null;
  }
  
  // Android Chrome 등에서 beforeinstallprompt가 없으면 숨김
  if (!isIOSSafari && !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              앱 아이콘을 홈 화면에 추가하세요
            </p>
            <p className="text-sm text-gray-500">
              앱처럼 편하게 사용할 수 있어요!
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4 flex space-x-2">
          <button
            onClick={handleInstallClick}
            className="flex-1 bg-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {isIOSSafari ? '방법 보기' : '추가하기'}
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 bg-gray-100 text-gray-700 text-sm font-medium py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
