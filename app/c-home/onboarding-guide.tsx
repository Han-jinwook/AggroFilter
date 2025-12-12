import Image from "next/image"

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
        <p className="text-sm font-semibold text-slate-800">유튜브 영상 URL을 입력하고 Enter를 눌러보세요</p>
        <p className="text-xs text-slate-600 leading-relaxed">
          빅데이터와 ChatGPT 기술로 영상의 신뢰도, 어그로성, 자막 요약을 즉시 분석해드립니다.
        </p>
      </div>
    </div>
  )
}
