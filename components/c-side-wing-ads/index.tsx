"use client"

import { usePathname } from 'next/navigation';

export function SideWingAds() {
  const pathname = usePathname();
  if (pathname?.startsWith('/p-admin')) return null;
  return (
    <>
      <div
        className="fixed top-28 z-40 hidden min-[1120px]:block w-[var(--app-wing-width)] h-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all hover:border-slate-300"
        style={{ left: 'calc(50% - (var(--app-max-width) * 0.5 + var(--app-wing-gutter) + var(--app-wing-width)))' }}
        aria-label="좌측 광고"
      >
        <div className="h-1 bg-gradient-to-r from-orange-400 via-red-500 to-pink-500" />
        <div className="px-3 pt-3">
          <div className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-1 text-[10px] font-black tracking-widest text-slate-700">
            AD
          </div>
        </div>
        <div className="flex h-[548px] flex-col items-center justify-center px-3">
          <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm px-3 py-4 text-center">
            <div className="text-xs font-black text-slate-900">제휴 배너 영역</div>
            <div className="mt-1 text-[11px] font-bold text-slate-500">브랜드/프로모션 샘플</div>
          </div>

          <div className="mt-3 w-full rounded-xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 px-3 py-3">
            <div className="text-[11px] font-bold text-slate-700">광고 문구</div>
            <div className="mt-1 text-[10px] font-semibold text-slate-500 leading-snug">
              앱 톤에 맞춘 라이트 카드 스타일
            </div>
            <div className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-black text-white">
              자세히 보기
            </div>
          </div>
        </div>
      </div>

      <div
        className="fixed top-28 z-40 hidden min-[1120px]:block w-[var(--app-wing-width)] overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all hover:border-slate-300"
        style={{ left: 'calc(50% + (var(--app-max-width) * 0.5 + var(--app-wing-gutter)))' }}
        aria-label="우측 광고"
      >
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
    </>
  )
}
