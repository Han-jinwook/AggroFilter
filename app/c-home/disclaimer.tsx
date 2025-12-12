interface TDisclaimerProps {
  isAnalyzing: boolean
  isCompleted: boolean
}

export function Disclaimer({ isAnalyzing, isCompleted }: TDisclaimerProps) {
  if (!isAnalyzing && !isCompleted) {
    return (
      <div className="space-y-2 pt-6 text-center text-xs text-muted-foreground leading-relaxed border-t border-slate-200">
        <p className="font-medium text-slate-700">본 서비스 이용 시 유의사항</p>
        <p>분석 결과는 개인 참고용이며, 외부 공표 및 배포가 금지됩니다.</p>
        <p>무단 복제 시 저작권 침해 및 법적 책임이 발생할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <p className="text-center text-sm text-muted-foreground pt-4">
      * AI는 실수를 할 수 있습니다. 중요한 정보를 확인하세요.
    </p>
  )
}
