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
        <p className="text-sm font-semibold text-slate-800">PC에서는 크롬 확장프로그램으로 분석을 시작하세요</p>
        <p className="text-xs text-slate-600 leading-relaxed">
          모바일에서는 분석 결과를 깔끔하게 조회하고, 필요하면 재분석을 요청할 수 있습니다.
        </p>

        <div className="pt-1">
          <Link
            href="/guide/extension"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-lg active:scale-[0.98]"
          >
            <TrendingUp className="h-3 w-3" />
            확장프로그램 설치/사용 가이드 보기
          </Link>
        </div>
      </div>
    </div>
  )
}
