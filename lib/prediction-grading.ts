export interface TierInfo {
  tier: 'S' | 'A' | 'B' | 'C' | 'F'
  label: string
  emoji: string
  message: string
  color: string
  bgColor: string
  borderColor: string
}

export function calculateReliability(accuracy: number, clickbait: number): number {
  return (accuracy + (100 - clickbait)) / 2
}

export function calculateGap(predicted: number, actual: number): number {
  return Math.abs(predicted - actual)
}

export function calculateTier(gap: number): TierInfo {
  if (gap <= 5) {
    return {
      tier: 'S',
      label: '오라클 (Oracle)',
      emoji: '👑',
      message: '신의 눈을 가졌습니다.',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      borderColor: 'border-yellow-400 dark:border-yellow-600'
    }
  } else if (gap <= 15) {
    return {
      tier: 'A',
      label: '팩트 판독기',
      emoji: '🔍',
      message: '상위 10%의 눈썰미!',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-400 dark:border-green-600'
    }
  } else if (gap <= 25) {
    return {
      tier: 'B',
      label: '일반인',
      emoji: '👤',
      message: '평범한 수준입니다.',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-400 dark:border-blue-600'
    }
  } else if (gap <= 40) {
    return {
      tier: 'C',
      label: '팔랑귀',
      emoji: '🎣',
      message: '썸네일에 너무 쉽게 낚이시네요.',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      borderColor: 'border-orange-400 dark:border-orange-600'
    }
  } else {
    return {
      tier: 'F',
      label: '호구 (Sucker)',
      emoji: '🐟',
      message: '당신의 시간은 유튜버의 것입니다.',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-400 dark:border-red-600'
    }
  }
}

export interface PredictionData {
  predictedAccuracy: number
  predictedClickbait: number
  actualReliability: number
}

export function gradePrediction(data: PredictionData) {
  const predictedReliability = calculateReliability(
    data.predictedAccuracy,
    data.predictedClickbait
  )
  const gap = calculateGap(predictedReliability, data.actualReliability)
  const tierInfo = calculateTier(gap)

  return {
    predictedReliability: Number(predictedReliability.toFixed(2)),
    gap: Number(gap.toFixed(2)),
    ...tierInfo
  }
}
