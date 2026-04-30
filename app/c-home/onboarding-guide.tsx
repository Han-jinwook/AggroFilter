import Image from "next/image"
import Link from "next/link"
import { TrendingUp } from "lucide-react"

export function OnboardingGuide() {
  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      <div className="h-32 w-32 flex-shrink-0">
        <Image
          src="/images/character-search.gif"
          alt="분석 캐릭터"
          width={128}
          height={128}
          className="h-full w-full object-contain"
          unoptimized
        />
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-lg font-bold text-slate-800 leading-snug">
          <span className="text-blue-600 text-xl font-black mr-0.5">PC</span>에서는 크롬 확장팩으로 분석을 시작하세요
        </p>
        <p className="text-lg font-bold text-slate-800 leading-snug">
          <span className="text-purple-600 text-xl font-black mr-0.5">모바일</span>에서는 모든 분석 결과에 대해 조회할 수 있습니다.
        </p>

        <div className="pt-2">
          <Link
            href="/guide/extension"
            className="group relative inline-flex items-center gap-4 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 px-12 py-6 text-xl font-black text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)] transition-all hover:-translate-y-2 hover:scale-[1.05] hover:shadow-[0_30px_60px_-15px_rgba(79,70,229,0.6)] active:scale-[0.95] overflow-hidden animate-glow-pulse"
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />
            
            <TrendingUp className="h-7 w-7 animate-pulse" />
            <span className="relative z-10">크롬 초간단 설치 3클릭으로</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
