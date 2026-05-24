"use client"

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { HubShareSquare } from '@/src/services/merlin-hub-sdk/react';

export function SideWingAds() {
  const pathname = usePathname();
  const [adFree, setAdFree] = useState(false);

  useEffect(() => {
    const checkAdFree = () => {
      // 확장팩 과금 분석 후 저장된 타임패스를 localStorage에서 직접 확인
      const until = localStorage.getItem('ad_free_until');
      if (until && new Date(until) > new Date()) {
        setAdFree(true);
      } else {
        setAdFree(false);
      }
    };
    checkAdFree();
    window.addEventListener('creditsUpdated', checkAdFree);
    return () => window.removeEventListener('creditsUpdated', checkAdFree);
  }, []);

  if (pathname?.startsWith('/p-admin')) return null;
  if (pathname?.startsWith('/payment') || pathname?.startsWith('/api/payment')) return null;

  let customTitle = "어그로필터 - 가짜 유튜브 영상 분석기";
  if (pathname?.startsWith('/p-result/')) {
    customTitle = "[어그로필터] 충격적인 이 영상의 신뢰도 점수는?";
  }

  return (
    <>
      <div
        className="fixed top-28 z-40 hidden min-[1120px]:flex flex-col gap-4 w-[var(--app-wing-width)]"
        style={{ left: 'calc(50% + (var(--app-max-width) * 0.5 + var(--app-wing-gutter)))' }}
        aria-label="우측 사이드 윙"
      >
        {/* 공유 스퀘어 (광고 유무 상관없이 항상 노출) */}
        <HubShareSquare customTitle={customTitle} />

        {/* 광고 영역 (adFree 상태면 숨김) */}
        {!adFree && (
          <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all hover:border-slate-300">
            <div className="h-1 bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400" />
            <div className="p-3">
              <div className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-1 text-[10px] font-black tracking-widest text-slate-700">
                AD
              </div>
            </div>

            <div className="px-3 pb-3">
              <div className="h-[220px] rounded-xl border border-slate-200 bg-white shadow-sm p-3 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900">파트너 배너</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">커뮤니티/카페/제휴</div>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 text-center">
                  배너 자리 (샘플)
                </div>
              </div>

              <div className="mt-3 h-[220px] rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900">앱 설치</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">QR / 바로가기</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="aspect-square rounded-lg border border-slate-200 bg-white shadow-sm" />
                  <div className="flex flex-col justify-center">
                    <div className="text-[11px] font-bold text-slate-700">AggroFilter</div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-500 leading-snug">
                      홈 화면에 추가해
                      <br />
                      더 빠르게 접속
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
