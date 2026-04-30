interface TDisclaimerProps {
  isAnalyzing: boolean
  isCompleted: boolean
}

export function Disclaimer({ isAnalyzing, isCompleted }: TDisclaimerProps) {
  if (!isAnalyzing && !isCompleted) {
    return (
      <div className="space-y-2 pt-6 text-center text-xs text-muted-foreground leading-relaxed border-t border-slate-200">
        <p className="font-medium text-slate-700">본 서비스 이용 시 유의사항</p>
        <p>본 분석 결과는 AI 알고리즘에 의한 참고용 정보로, 법적 판단의 근거가 될 수 없습니다.</p>
        <p>분석 결과를 외부 커뮤니티나 SNS에 공유하실 때는 &apos;어그로필터&apos; 출처를 꼭 명시해 주세요!</p>
      </div>
    )
  }

  return (
    <p className="text-center text-sm text-muted-foreground pt-4">
      * AI는 실수를 할 수 있습니다. 중요한 정보를 확인하세요.
    </p>
  )
}
