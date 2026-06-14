'use client';

import React, { useEffect, useState } from 'react';
import { HubShareSquare } from '../Referral/HubShareSquare';
import { HubGoogleAd } from './HubGoogleAd';

import { usePathname } from 'next/navigation';

export interface HubResponsiveWingProps {
  /** 하단 배너 고유 ID (닫기 상태 저장용) */
  bannerId: string;
  /** 윙/배너 전체 숨김 여부 (adFree 과금 상태일 때 등) */
  hide?: boolean;
  
  /** 공유 카드 렌더링용: 제목 (입력 시 공유 카드 자동 노출) */
  shareTitle?: string;
  /** 공유 카드 렌더링용: 설명 */
  shareDescription?: string;
  /** 모바일 플로팅 버튼(FAB) 노출 지연 시간 (밀리초). 기본값: 60000 (1분) */
  mobileShareDelayMs?: number;

  /** 우측 사이드 윙에 들어갈 추가 컨텐츠 (구글 광고 슬롯 등) */
  sideContent?: React.ReactNode;
  
  /** 구글 애드센스 클라이언트 ID (입력 시 HubGoogleAd 렌더링 가능) */
  adClient?: string;
  /** 우측 사이드 윙에 달릴 구글 광고 슬롯 ID */
  sideAdSlot?: string;
  /** 하단 모바일 배너에 달릴 구글 광고 슬롯 ID */
  bottomAdSlot?: string;

  /** 하단 모바일 배너 우측 액션 버튼 */
  bottomActionButton?: React.ReactNode;
  /** 하단 모바일 배너에 구글 광고 대신 들어갈 대체 텍스트 컨텐츠 */
  bottomContent?: React.ReactNode;
}

export function HubResponsiveWing({
  bannerId,
  hide = false,
  shareTitle,
  shareDescription,
  mobileShareDelayMs = 60000,
  sideContent,
  adClient,
  sideAdSlot,
  bottomAdSlot,
  bottomActionButton,
  bottomContent
}: HubResponsiveWingProps) {
  const [isClosed, setIsClosed] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const pathname = usePathname();
  const storageKey = `hub_bottom_banner_closed_${bannerId}`;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === '1') {
        setIsClosed(true);
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    // 페이지 이동 시 FAB 숨김 처리 후 타이머 재시작 (페이지당 1분)
    setShowFab(false);

    // 모바일 FAB 지연 노출 로직 (Time-based Nudge)
    if (shareTitle && mobileShareDelayMs > 0) {
      const timer = setTimeout(() => setShowFab(true), mobileShareDelayMs);
      return () => clearTimeout(timer);
    } else if (shareTitle && mobileShareDelayMs === 0) {
      setShowFab(true);
    }
  }, [shareTitle, mobileShareDelayMs, pathname]);

  // 바텀 시트 스크롤 방지
  useEffect(() => {
    if (isShareSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isShareSheetOpen]);

  if (hide) return null;

  return (
    <>
      {/* 1. PC 데스크톱용 우측 사이드 윙 (1120px 이상에서만 노출) */}
      <aside
        className="fixed hidden min-[1120px]:block w-[var(--app-wing-width,160px)] z-40 select-none"
        style={{ 
          left: 'calc(50% + (var(--app-max-width,800px) * 0.5 + var(--app-wing-gutter,8px)))',
          top: 'calc(var(--app-header-height, 62px) + 16px)',
          bottom: 16
        }}
        aria-label="우측 사이드 영역"
      >
        <div className="flex flex-col gap-4 w-full h-full overflow-y-auto overflow-x-hidden pb-4 custom-scrollbar">
          
          {/* 초대 카드 (공유 스퀘어) - 제목이 있으면 무조건 상단 렌더링 */}
          {shareTitle && (
            <HubShareSquare customTitle={shareTitle} description={shareDescription} />
          )}

          {/* 구글 광고 렌더링 (adClient와 sideAdSlot이 있을 때) */}
          {adClient && sideAdSlot && (
            <div className="w-full shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
              <div className="h-1 bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400" />
              <div className="p-3">
                <div className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-1 text-[10px] font-black tracking-widest text-slate-700">
                  AD
                </div>
              </div>
              <div className="px-3 pb-3">
                <HubGoogleAd client={adClient} slot={sideAdSlot} />
              </div>
            </div>
          )}

          {/* 커스텀 사이드 추가 컨텐츠 */}
          {sideContent}
        </div>
      </aside>

      {/* 2. 모바일/축소화면용 하단 고정 배너 및 모바일 공유 기능 (1120px 미만에서만 노출) */}
      <div className="min-[1120px]:hidden select-none">
        {/* 우측 하단 플로팅 액션 버튼 (FAB) - 지연 노출 */}
        {shareTitle && showFab && !isShareSheetOpen && (
          <button
            onClick={() => setIsShareSheetOpen(true)}
            className="fixed z-[60] flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 active:scale-[0.95] transition-all cursor-pointer animate-[bounce_1s_ease-in-out_3]"
            style={{ 
              bottom: isClosed ? 'calc(16px + env(safe-area-inset-bottom))' : 'calc(56px + 16px + env(safe-area-inset-bottom))', 
              right: '16px' 
            }}
            aria-label="초대하기"
          >
            <span className="text-2xl">🎁</span>
          </button>
        )}

        {/* 바텀 시트 (초대 모달) */}
        {shareTitle && isShareSheetOpen && (
          <div className="fixed inset-0 z-[70] flex flex-col justify-end">
            {/* 뒷배경 딤 처리 */}
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" 
              onClick={() => setIsShareSheetOpen(false)}
            />
            {/* 시트 컨텐츠 */}
            <div className="relative bg-slate-50 w-full rounded-t-3xl shadow-2xl p-4 pb-[calc(16px+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-full duration-300">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
              <div className="max-w-md mx-auto w-full">
                <HubShareSquare customTitle={shareTitle} description={shareDescription} />
              </div>
            </div>
          </div>
        )}

        {/* 스티키 하단 광고 배너 */}
        {!isClosed && (
          <>
            {/* 배너가 차지하는 공간 확보용 더미 (safe-area 포함) */}
            <div style={{ height: 'calc(56px + env(safe-area-inset-bottom))' }} aria-hidden />
            <div 
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A1A]/80 backdrop-blur-md border-t border-white/10"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="h-14 mx-auto flex max-w-[var(--app-max-width,800px)] items-center justify-between px-3 sm:px-4">
                
                {/* 하단 광고 컨텐츠 */}
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <div className="inline-flex items-center rounded-sm bg-white/20 px-1 py-0.5 text-[9px] font-black tracking-widest text-white/80">
                    AD
                  </div>
                  {adClient && bottomAdSlot ? (
                    <div className="w-full max-w-[320px] h-[50px] overflow-hidden">
                      <HubGoogleAd client={adClient} slot={bottomAdSlot} format="horizontal" />
                    </div>
                  ) : (
                    bottomContent
                  )}
                </div>

                <div className="flex items-center gap-2 pl-3">
                  {bottomActionButton}
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        window.localStorage.setItem(storageKey, '1');
                      } catch {}
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
          </>
        )}
      </div>
    </>
  );
}
