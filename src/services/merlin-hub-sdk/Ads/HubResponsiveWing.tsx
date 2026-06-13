'use client';

import React, { useEffect, useState } from 'react';
import { HubShareSquare } from '../Referral/HubShareSquare';
import { HubGoogleAd } from './HubGoogleAd';

export interface HubResponsiveWingProps {
  /** 하단 배너 고유 ID (닫기 상태 저장용) */
  bannerId: string;
  /** 윙/배너 전체 숨김 여부 (adFree 과금 상태일 때 등) */
  hide?: boolean;
  
  /** 공유 카드 렌더링용: 제목 (입력 시 공유 카드 자동 노출) */
  shareTitle?: string;
  /** 공유 카드 렌더링용: 설명 */
  shareDescription?: string;

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
  sideContent,
  adClient,
  sideAdSlot,
  bottomAdSlot,
  bottomActionButton,
  bottomContent
}: HubResponsiveWingProps) {
  const [isClosed, setIsClosed] = useState(false);
  const storageKey = `hub_bottom_banner_closed_${bannerId}`;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === '1') {
        setIsClosed(true);
      }
    } catch {}
  }, [storageKey]);

  if (hide) return null;

  return (
    <>
      {/* 1. PC 데스크톱용 우측 사이드 윙 (1120px 이상에서만 노출) */}
      <aside
        className="fixed hidden min-[1120px]:block w-[var(--app-wing-width,160px)] z-40"
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

      {/* 2. 모바일/축소화면용 하단 고정 배너 (1120px 미만에서만 노출) */}
      {!isClosed && (
        <>
          <div className="h-14 min-[1120px]:hidden" aria-hidden />
          <div className="fixed bottom-0 left-0 right-0 z-50 min-[1120px]:hidden">
            <div className="h-14 bg-[#1A1A1A]/80 backdrop-blur-md border-t border-white/10">
              <div className="mx-auto flex h-full max-w-[var(--app-max-width,800px)] items-center justify-between px-3 sm:px-4">
                
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
          </div>
        </>
      )}
    </>
  );
}
