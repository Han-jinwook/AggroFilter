/**
 * Version: v1.0.6
 * Last Updated: 2026-06-11
 */
import React, { useState, useEffect } from 'react';
import { useHubReferral } from './useHubReferral';
import { useHub } from '../HubProvider';
import { triggerHaptic } from '../CoreLogic/haptic';

interface HubShareSquareProps {
  className?: string;
  customTitle?: string;
  customUrl?: string;
  description?: string;
}

/**
 * [Custom] 공유 스퀘어 위젯
 * 현재 페이지의 URL과 추천인 코드를 결합하여 공유 액션을 돕는 유틸리티입니다.
 */
export const HubShareSquare: React.FC<HubShareSquareProps> = ({
  className = '',
  customTitle = '이 페이지를 친구에게 공유해보세요!',
  customUrl,
  description = '공유 링크에는 내 추천인 코드가 포함되어 전달됩니다.',
}) => {
  const [pathname, setPathname] = useState('');
  const { getMyReferralInfo, isLoading } = useHubReferral();
  const { isLoggedIn, isLoading: isSessionLoading } = useHub();
  const [inviteCode, setInviteCode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userReferralCode') || '';
    }
    return '';
  });
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPathname(window.location.pathname);
      const handleLocationChange = () => {
        setPathname(window.location.pathname);
      };
      window.addEventListener('popstate', handleLocationChange);
      return () => {
        window.removeEventListener('popstate', handleLocationChange);
      };
    }
  }, []);

  useEffect(() => {
    const fetchInfo = async () => {
      const info = await getMyReferralInfo();
      if (info?.code) {
        setInviteCode(info.code);
        if (typeof window !== 'undefined') {
          localStorage.setItem('userReferralCode', info.code);
        }
      }
    };

    // 토큰 존재 여부 확인 (로컬스토리지 안전 장치)
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('merlin_session_token');

    if (isLoggedIn) {
      fetchInfo();
    } else if (!isSessionLoading && !hasToken) {
      // 세션 로딩이 완전히 종료되었고, 세션 토큰도 없는 명백한 비로그인 상태일 때만 지운다.
      setInviteCode('');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('userReferralCode');
      }
    }
  }, [getMyReferralInfo, isLoggedIn, isSessionLoading]);

  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true);
    }
  }, []);

  // 페이지 이동(또는 customUrl 변경) 시 복사 완료 상태 초기화
  useEffect(() => {
    setIsCopied(false);
  }, [pathname, customUrl]);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    
    let shareUrl = '';
    let base = customUrl || window.location.href;
    
    try {
      const urlObj = new URL(base);
      // Private/internal pages shouldn't be shared. Redirect invitees to the root onboarding page.
      const privatePaths = [
        '/profile',
        '/whateat/profile',
        '/admin7878',
        '/p-settings',
        '/p-my-page',
        '/p-notification',
        '/p-history',
        '/p-admin',
        '/payment',
        '/login'
      ];
      if (privatePaths.some(p => urlObj.pathname.startsWith(p))) {
        urlObj.pathname = '/';
        urlObj.search = '';
      }
      base = urlObj.toString();
    } catch (e) {
      // fallback
    }

    // 추천인 코드 확보 (상태값, 로컬스토리지, 또는 즉시 조회)
    let currentCode = inviteCode || (typeof window !== 'undefined' ? localStorage.getItem('userReferralCode') : '') || '';
    if (!currentCode && isLoggedIn) {
      try {
        const info = await getMyReferralInfo();
        if (info?.code) {
          currentCode = info.code;
          setInviteCode(info.code);
          if (typeof window !== 'undefined') {
            localStorage.setItem('userReferralCode', info.code);
          }
        }
      } catch (err) {
        console.warn('[HubShareSquare] Failed to fetch referral info on share:', err);
      }
    }
    
    if (currentCode) {
      try {
        const urlObj = new URL(base);
        urlObj.searchParams.set('ref', currentCode);
        shareUrl = urlObj.toString();
      } catch (e) {
        shareUrl = `${base}${base.includes('?') ? '&' : '?'}ref=${currentCode}`;
      }
    } else {
      shareUrl = base;
    }
    
    // 복사/공유 텍스트 (카카오톡 및 문자 전달 시 초대 링크가 본문 메시지에 100% 명확히 포함되도록 포맷)
    const shareText = description 
      ? `${customTitle}\n\n${description}\n\n👉 바로가기: ${shareUrl}`
      : `${customTitle}\n\n👉 바로가기: ${shareUrl}`;
    const textToCopy = `${shareText}`;

    // 모바일 / PWA Web Share API 우선 호출 (카카오톡, 문자 등 네이티브 공유창 호출)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: customTitle,
          text: shareText,
          url: shareUrl,
        });
        triggerHaptic('success');
        return;
      } catch (err: any) {
        // 유저가 취소(AbortError)한 경우 복사 fallback 하지 않고 종료
        if (err?.name === 'AbortError') {
          return;
        }
        console.log('[HubShareSquare] Native share fallback to clipboard:', err);
      }
    }
    
    // PC 또는 네이티브 미지원 환경: 클립보드 복사
    try {
      await navigator.clipboard.writeText(textToCopy);
      triggerHaptic('success');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('[HubShareSquare] Clipboard copy failed:', e);
    }
  };

  if (isLoading && !inviteCode) {
    return <div className="w-full h-48 bg-slate-100 animate-pulse rounded-2xl" />;
  }

  return (
    <div className={`w-[160px] bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 rounded-2xl p-5 text-white relative overflow-hidden shadow-lg ${className}`}>
      {/* 3D 느낌의 꾸밈 요소 */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-xl"></div>
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-indigo-900/20 blur-xl"></div>

      <div className="relative z-10 flex flex-col h-full justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold leading-snug tracking-tight line-clamp-2">
            {customTitle}
          </h3>
          <p className="text-[11px] text-blue-100 mt-2 leading-relaxed opacity-90 whitespace-pre-line">
            {description}
          </p>
        </div>

        <button
          onClick={handleShare}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold cursor-pointer transition-all shadow-sm active:scale-[0.98] ${
            isCopied 
              ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
              : 'bg-white text-blue-600 hover:bg-blue-50 shadow-white/10'
          }`}
        >
          {isCopied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              복사 완료!
            </>
          ) : canNativeShare ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              카톡/앱으로 공유
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              링크 복사하기
            </>
          )}
        </button>
      </div>
    </div>
  );
};
