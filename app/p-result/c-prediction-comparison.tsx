"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Share2, MessageSquare } from "lucide-react"
import { calculateReliability, calculateGap, calculateTier, type TierInfo } from "@/lib/prediction-grading"
import { getUserId } from "@/lib/anon"

interface PredictionComparisonProps {
  analysisId: string
  actualReliability: number
}

interface PredictionData {
  url: string
  accuracy: number
  clickbait: number
  predictedReliability: number
  submittedAt: number
}

export function PredictionComparison({ analysisId, actualReliability }: PredictionComparisonProps) {
  const [prediction, setPrediction] = useState<PredictionData | null>(null)
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null)
  const [gap, setGap] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  const saveToDatabase = useCallback(
    async (data: PredictionData, gap: number, tier: TierInfo) => {
      if (savingRef.current) return
      savingRef.current = true
      setSaving(true)

      try {
        const response = await fetch("/api/prediction/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysisId,
            predictedAccuracy: data.accuracy,
            predictedClickbait: data.clickbait,
            actualReliability,
            userEmail: typeof window !== 'undefined' ? getUserId() || undefined : undefined,
          }),
        })

        if (!response.ok && response.status !== 409) {
          console.error("Failed to save prediction")
        }
      } catch (error) {
        console.error("Error saving prediction:", error)
      } finally {
        setSaving(false)
        savingRef.current = false
      }
    },
    [analysisId, actualReliability]
  )

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("prediction_quiz_v1")
      if (!stored) return

      const data: PredictionData = JSON.parse(stored)
      setPrediction(data)

      const calculatedGap = calculateGap(data.predictedReliability, actualReliability)
      const tier = calculateTier(calculatedGap)
      
      setGap(calculatedGap)
      setTierInfo(tier)

      saveToDatabase(data, calculatedGap, tier)
    } catch (error) {
      console.error("Failed to load prediction:", error)
    }
  }, [analysisId, actualReliability, saveToDatabase])

  if (!prediction || !tierInfo) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6"
    >
      <div className={`rounded-2xl border-2 p-6 ${tierInfo.bgColor} ${tierInfo.borderColor}`}>
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold mb-1">🎯 디지털 선구안 테스트 결과</h3>
          <p className="text-sm text-muted-foreground">당신의 예측 vs AI 분석</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-2">내 예측</div>
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {prediction.predictedReliability}
            </div>
            <div className="text-xs text-muted-foreground">
              정확성 {prediction.accuracy} / 어그로 {prediction.clickbait}
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-2">AI 분석</div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {Math.round(actualReliability)}
            </div>
            <div className="text-xs text-muted-foreground">
              실제 신뢰도
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 text-center mb-4">
          <div className="text-sm text-muted-foreground mb-2">오차</div>
          <div className="text-3xl font-bold mb-4">{gap.toFixed(1)}점</div>
          
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full border-2 ${tierInfo.bgColor} ${tierInfo.borderColor}`}>
            <span className="text-4xl">{tierInfo.emoji}</span>
            <div className="text-left">
              <div className={`text-2xl font-bold ${tierInfo.color}`}>
                {tierInfo.tier}급
              </div>
              <div className="text-sm font-medium">{tierInfo.label}</div>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mt-4">
            {tierInfo.message}
          </p>
        </div>

        <div className="flex gap-3">
          <button 
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
            onClick={() => {
              const text = `나는 ${tierInfo.tier}급 (${tierInfo.label})! 오차 ${gap.toFixed(1)}점으로 영상 신뢰도를 예측했어요 🎯`
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
              if (isMobile && navigator.share) {
                navigator.share({ text }).catch(() => {})
              } else {
                navigator.clipboard.writeText(text)
                const btn = document.activeElement as HTMLButtonElement
                if (btn) {
                  const orig = btn.textContent
                  btn.textContent = '✅ 복사됨!'
                  setTimeout(() => { btn.textContent = orig }, 2000)
                }
              }
            }}
          >
            <Share2 className="w-4 h-4" />
            결과 공유
          </button>
          <button 
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors text-sm font-medium"
            onClick={() => {
              const commentSection = document.querySelector('[data-comment-section]')
              if (commentSection) {
                commentSection.scrollIntoView({ behavior: 'smooth' })
              }
            }}
          >
            <MessageSquare className="w-4 h-4" />
            댓글로 자랑하기
          </button>
        </div>
      </div>
    </motion.div>
  )
}
