"use client"

import { calculateTier } from "@/lib/prediction-grading"

const TIER_ROADMAP = [
  {
    tier: 'S',
    label: '오라클 (Oracle)',
    emoji: '👑',
    maxGap: 5,
    description: '신의 눈을 가졌습니다.',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
    borderColor: 'border-yellow-400 dark:border-yellow-600',
  },
  {
    tier: 'A',
    label: '팩트 판독기',
    emoji: '🔍',
    maxGap: 15,
    description: '상위 10%의 눈썰미!',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-400 dark:border-green-600',
  },
  {
    tier: 'B',
    label: '일반인',
    emoji: '👤',
    maxGap: 25,
    description: '평범한 수준입니다.',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-400 dark:border-blue-600',
  },
  {
    tier: 'C',
    label: '팔랑귀',
    emoji: '🎣',
    maxGap: 40,
    description: '썸네일에 너무 쉽게 낚이시네요.',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-400 dark:border-orange-600',
  },
  {
    tier: 'F',
    label: '호구 (Sucker)',
    emoji: '🐟',
    maxGap: 999,
    description: '당신의 시간은 유튜버의 것입니다.',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-400 dark:border-red-600',
  },
]

interface TierRoadmapProps {
  currentTier?: string
  currentGap?: number
}

export function TierRoadmap({ currentTier = 'B', currentGap = 0 }: TierRoadmapProps) {
  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">등급 로드맵</h2>
      <p className="text-sm text-muted-foreground mb-6">
        예측 오차가 작을수록 높은 등급을 획득합니다
      </p>

      <div className="space-y-3">
        {TIER_ROADMAP.map((tier, index) => {
          const isCurrentTier = tier.tier === currentTier
          const isPrevGap = index === 0 ? 0 : TIER_ROADMAP[index - 1].maxGap
          const gapRange = index === TIER_ROADMAP.length - 1 
            ? `${isPrevGap + 1}점 이상`
            : `${isPrevGap === 0 ? 0 : isPrevGap + 1}~${tier.maxGap}점`

          return (
            <div
              key={tier.tier}
              className={`relative rounded-xl border-2 p-4 transition-all ${
                isCurrentTier
                  ? `${tier.bgColor} ${tier.borderColor} shadow-md`
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50'
              }`}
            >
              {isCurrentTier && (
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                  현재 등급
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                    isCurrentTier ? tier.bgColor : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    {tier.emoji}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${isCurrentTier ? tier.color : 'text-muted-foreground'}`}>
                        {tier.tier}급
                      </span>
                      <span className={`text-sm font-medium ${isCurrentTier ? '' : 'text-muted-foreground'}`}>
                        {tier.label}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold ${isCurrentTier ? tier.color : 'text-muted-foreground'}`}>
                      {gapRange}
                    </span>
                  </div>

                  <p className={`text-xs ${isCurrentTier ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {tier.description}
                  </p>

                  {isCurrentTier && currentGap > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-muted-foreground">
                        현재 평균 오차: <span className={tier.color}>{currentGap.toFixed(1)}점</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {index < TIER_ROADMAP.length - 1 && !isCurrentTier && (
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-0.5 h-4 bg-gray-300 dark:bg-gray-700" />
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-muted-foreground">
          💡 <span className="font-semibold">팁:</span> 영상 분석 전 예측 퀴즈를 풀면 등급이 갱신됩니다. 
          정확하게 예측할수록 높은 등급을 유지할 수 있어요!
        </p>
      </div>
    </div>
  )
}
