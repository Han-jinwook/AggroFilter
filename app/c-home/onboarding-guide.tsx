"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Smartphone, Monitor, Sparkles, TrendingUp, ArrowRight } from "lucide-react"

export function OnboardingGuide() {
  const [activeTab, setActiveTab] = useState<"mobile" | "pc">("mobile")

  useEffect(() => {
    // 디바이스 환경 자동 감지 (모바일 접속 시 모바일 탭 기본 활성화)
    if (typeof window !== "undefined") {
      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth < 768
      setActiveTab(isMobileDevice ? "mobile" : "pc")
    }
  }, [])

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-3xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-5 space-y-4">
      {/* 디바이스 탭 전환 바 */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border-2 border-black">
        <button
          type="button"
          onClick={() => setActiveTab("mobile")}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "mobile"
              ? "bg-[#6366f1] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>📱 모바일 10초 분석법</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pc")}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "pc"
              ? "bg-[#FF9800] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>🖥️ PC 크롬 확장팩</span>
        </button>
      </div>

      {/* 탭 1: 모바일 이용 안내 */}
      {activeTab === "mobile" && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0">
              <Image
                src="/images/character-search.gif"
                alt="분석 캐릭터"
                width={64}
                height={64}
                className="h-full w-full object-contain"
                unoptimized
              />
            </div>
            <div>
              <p className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                스마트폰에서도 <span className="text-indigo-600 font-extrabold">10초 만에 결론 스포일러!</span>
              </p>
              <p className="text-xs font-bold text-slate-500">
                복잡한 설치 없이 유튜브 앱에서 즉시 분석할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="grid gap-2 text-xs font-bold text-slate-700">
            <div className="p-3 bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                1
              </div>
              <div className="space-y-0.5">
                <p className="font-black text-indigo-950 text-xs sm:text-sm">유튜브 앱 [공유] ➔ [어그로필터] 터치</p>
                <p className="text-slate-600 text-[11px] font-medium leading-relaxed">
                  유튜브에서 보고 있던 영상의 [공유] 버튼을 누른 뒤 어그로필터를 선택하면 10초 만에 결과가 열립니다.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                2
              </div>
              <div className="space-y-0.5">
                <p className="font-black text-slate-900 text-xs sm:text-sm">또는 영상 링크 복사 ➔ 상단 입력창 붙여넣기</p>
                <p className="text-slate-600 text-[11px] font-medium leading-relaxed">
                  유튜브 링크를 복사하여 바로 위 입력창에 넣고 [⚡ 즉시 분석]을 누르면 똑같이 10초 만에 판독됩니다.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl text-[11px] font-bold text-amber-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>💡 브라우저 메뉴에서 <b>&apos;홈 화면에 추가&apos;</b>하시면 스마트폰 공유 목록에 자동 등록됩니다.</span>
          </div>
        </div>
      )}

      {/* 탭 2: PC 크롬 확장팩 안내 (기존 화려한 가이드 100% 보존) */}
      {activeTab === "pc" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0">
              <Image
                src="/images/character-search.gif"
                alt="분석 캐릭터"
                width={64}
                height={64}
                className="h-full w-full object-contain"
                unoptimized
              />
            </div>
            <div>
              <p className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                PC에서는 <span className="text-blue-600 font-extrabold">유튜브 밑 1클릭 버튼</span>으로 분석!
              </p>
              <p className="text-xs font-bold text-slate-500">
                확장팩을 설치하면 유튜브 영상 밑에 분석 버튼이 자동 생성됩니다.
              </p>
            </div>
          </div>

          <div className="pt-1">
            <Link
              href="/guide/extension"
              className="w-full group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 py-4 text-sm sm:text-base font-black text-white shadow-[0_10px_25px_-5px_rgba(79,70,229,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden border-2 border-black"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />
              <TrendingUp className="h-5 w-5 animate-pulse" />
              <span className="relative z-10">크롬 초간단 설치 3클릭으로 가기</span>
              <ArrowRight className="h-4 w-4 relative z-10" />
            </Link>
          </div>

          <p className="text-center text-[11px] font-bold text-slate-500">
            확장팩 없이도 상단 입력창에 유튜브 링크를 붙여넣으면 10초 만에 분석됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
