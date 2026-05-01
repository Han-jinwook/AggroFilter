import Link from "next/link"
import { Sparkles, Shield, TrendingUp } from "lucide-react"

interface TFeatureCard {
  icon: typeof Sparkles
  title: string
  description: string
  gradient: string
  iconColor: string
}

const features: TFeatureCard[] = [
  {
    icon: Sparkles,
    title: "썸네일 스포일러",
    description: "중요 영상 클릭 전 필수! 제목과 썸네일이 숨긴 진짜 결론을 10초 만에 즉시 확인하세요",
    gradient: "from-blue-50 to-blue-100",
    iconColor: "bg-blue-500",
  },
  {
    icon: Shield,
    title: "AI 정밀 팩트체크",
    description: "어그로성 조작부터 허위 사실까지, AI가 영상 전체를 꼼꼼하게 분석해 신뢰도 신호등을 켜드립니다.",
    gradient: "from-rose-50 to-rose-100",
    iconColor: "bg-rose-500",
  },
  {
    icon: TrendingUp,
    title: "청정 유튜버 랭킹",
    description: "어그로 없는 진짜 유익한 채널은 어디일까? 누적 분석 데이터 기반 종합 순위를 확인하세요.",
    gradient: "from-amber-50 to-amber-100",
    iconColor: "bg-amber-500",
  },
]

export function FeatureCards() {
  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-3 md:grid-cols-3">
        {features.map((feature, index) => (
          <div
            key={index}
            className={`flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br ${feature.gradient} p-4 shadow-sm transition-all hover:shadow-md`}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${feature.iconColor} text-white`}>
              <feature.icon className="h-6 w-6" />
            </div>
            <h3 className="text-center text-sm font-semibold text-slate-800">{feature.title}</h3>
            <p className="text-center text-xs text-slate-600 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
