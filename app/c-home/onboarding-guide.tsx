import Image from "next/image"
import Link from "next/link"

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
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            확장프로그램 설치/사용 가이드 보기
          </Link>
        </div>
      </div>
    </div>
  )
}
