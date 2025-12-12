import Image from "next/image"

interface TAnalysisStatusProps {
  isAnalyzing: boolean
  isCompleted: boolean
}

export function AnalysisStatus({ isAnalyzing, isCompleted }: TAnalysisStatusProps) {
  if (!isAnalyzing && !isCompleted) return null

  return (
    <div className="min-h-[28px] flex items-center justify-center">
      {isAnalyzing && (
        <div className="flex items-center justify-center gap-0.5">
          <span className="animate-bounce-text text-2xl font-bold">분</span>
          <span className="animate-bounce-text anim-delay-100 text-2xl font-bold">석</span>
          <span className="animate-bounce-text anim-delay-200 text-2xl font-bold">&nbsp;</span>
          <span className="animate-bounce-text anim-delay-300 text-2xl font-bold">중</span>
          <span className="animate-pulse-dot text-2xl font-bold">.</span>
          <span className="animate-pulse-dot anim-delay-200 text-2xl font-bold">.</span>
          <span className="animate-pulse-dot anim-delay-400 text-2xl font-bold">.</span>
        </div>
      )}
      {isCompleted && (
        <div className="inline-flex items-baseline gap-2">
          <span className="text-2xl font-bold">( 분석 </span>
          <span className="text-3xl font-bold text-[#FF9800]">완료</span>
          <span className="text-2xl font-bold"> )</span>
        </div>
      )}
    </div>
  )
}

export function AnalysisCharacter({ isAnalyzing, isCompleted }: TAnalysisStatusProps) {
  if (isAnalyzing) {
    return (
      <div className="flex justify-center py-6">
        <Image
          src="/images/character-analyzing.gif"
          alt="분석 중"
          width={300}
          height={300}
          className="h-auto w-64"
          unoptimized
        />
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="flex justify-center py-6">
        <Image src="/images/character-completed.png" alt="분석 완료" width={300} height={300} className="h-auto w-64" />
      </div>
    )
  }

  return null
}
