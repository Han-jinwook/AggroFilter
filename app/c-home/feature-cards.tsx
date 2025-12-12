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
    title: "AI 신뢰도 분석",
    description: "논리적 일관성과 정확성을 기반으로 콘텐츠 신뢰도 평가",
    gradient: "from-blue-50 to-blue-100",
    iconColor: "bg-blue-500",
  },
  {
    icon: Shield,
    title: "어그로 감지",
    description: "자극적 표현과 낚시성 제목을 분석하여 점수화",
    gradient: "from-rose-50 to-rose-100",
    iconColor: "bg-rose-500",
  },
  {
    icon: TrendingUp,
    title: "채널 순위",
    description: "자막 분석과 종합 리포트로 채널 순위 제공",
    gradient: "from-amber-50 to-amber-100",
    iconColor: "bg-amber-500",
  },
]

export function FeatureCards() {
  return (
    <div className="grid gap-3 md:grid-cols-3 pt-4">
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
  )
}
