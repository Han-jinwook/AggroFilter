'use client';

import React, { useEffect, useState } from 'react';

/**
 * HubBottomBanner
 * 화면 폭이 1120px 미만일 때(사이드 윙이 숨겨질 때) 화면 하단에 고정되는 배너 컨테이너입니다.
 * 닫기 버튼을 클릭하면 세션 동안 숨김 처리됩니다.
 */
interface HubBottomBannerProps {
  /** 배너 아이디 (고유 키로 사용되어 닫기 상태를 구별) */
  bannerId: string;
  /** 배너 우측 커스텀 버튼 (예: '자세히' 버튼 등) */
  actionButton?: React.ReactNode;
  /** 배너 컨텐츠 영역 */
  children: React.ReactNode;
  /** 배너 강제 숨김 여부 (예: adFree 상태일 때 true) */
  hide?: boolean;
}

export function HubBottomBanner({ bannerId, actionButton, children, hide = false }: HubBottomBannerProps) {
  const [isClosed, setIsClosed] = useState(false);
  const storageKey = `hub_bottom_banner_closed_${bannerId}`;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === '1') {
        setIsClosed(true);
      }
    } catch {
      // localStorage 접근 불가 에러 무시
    }
  }, [storageKey]);

  if (hide || isClosed) return null;

  return (
    <>
      <div className="h-14 min-[1120px]:hidden" aria-hidden />
      <div className="fixed bottom-0 left-0 right-0 z-50 min-[1120px]:hidden">
        <div className="h-14 bg-[#1A1A1A]/80 backdrop-blur-md border-t border-white/10">
          <div className="mx-auto flex h-full max-w-[var(--app-max-width)] items-center justify-between px-3 sm:px-4">
            
            <div className="min-w-0 flex-1">
              {children}
            </div>

            <div className="flex items-center gap-2 pl-3">
              {actionButton}
              <button
                type="button"
                onClick={() => {
                  try {
                    window.localStorage.setItem(storageKey, '1');
                  } catch {
                    // ignore
                  }
                  setIsClosed(true);
                }}
                className="h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-[0.99] transition cursor-pointer"
                aria-label="배너 닫기"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
