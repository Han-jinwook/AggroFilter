"use client"

import Image from "next/image"
import { useState } from "react"

interface TScoreCardProps {
  accuracy: number | null | undefined
  clickbait: number | null | undefined
  trust: number | null | undefined
  topic: string
  trafficLightImage: string
  recheckDelta?: {
    before: { accuracy: number | null; clickbait: number | null; trust: number | null }
    after: { accuracy: number | null; clickbait: number | null; trust: number | null }
  }
  prediction?: {
    predictedReliability: number
    gap: number
    tier: string
    tierLabel: string
    tierEmoji: string
    totalPredictions: number
    avgGap: number
  }
}

export function ScoreCard({ accuracy, clickbait, trust, topic, trafficLightImage, recheckDelta, prediction }: TScoreCardProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

  const accuracyText = typeof accuracy === "number" ? `${accuracy}%` : "-"
  const clickbaitText = typeof clickbait === "number" ? `${clickbait}%` : "-"
  const trustText = typeof trust === "number" ? String(trust) : "-"

  const clickbaitTier = (() => {
    if (typeof clickbait !== 'number' || Number.isNaN(clickbait)) return null
    if (clickbait <= 20) return '일치/마케팅/훅'
    if (clickbait <= 40) return '과장(오해/시간적 피해/낚임 수준)'
    if (clickbait <= 60) return '왜곡(혼란/짜증)'
    return '허위/조작(실질 손실 가능)'
  })()

  const formatDeltaRow = (label: string, before: number | null, after: number | null, isPercent: boolean) => {
    if (before === null || after === null) return null
    const diff = after - before
    const diffText = diff === 0 ? "0" : diff > 0 ? `+${diff}` : `${diff}`
    const valueBefore = isPercent ? `${before}%` : String(before)
    const valueAfter = isPercent ? `${after}%` : String(after)
    const diffClass = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-500"
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-700">{label}</span>
        <div className="flex items-center gap-1 font-bold">
          <span className="text-slate-500">{valueBefore}</span>
          <span className="text-slate-300">→</span>
          <span className="text-slate-900">{valueAfter}</span>
          <span className={diffClass}>({diffText})</span>
        </div>
      </div>
    )
  }

  const toggleTooltip = (type: string) => {
    setActiveTooltip(activeTooltip === type ? null : type)
  }

  return (
    <div className="relative rounded-3xl bg-blue-100 px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="rounded-2xl bg-blue-200 px-3 py-1">
          <h2 className="text-lg font-bold text-pink-500">분석 보고</h2>
        </div>
        <span className="rounded-full border-2 border-pink-400 bg-white px-3 py-0.5 text-sm font-medium text-pink-600">
          #{topic}
        </span>
      </div>

      <div className="relative">
        <div className="absolute -top-8 right-3 z-10">
          <Image
            src={trafficLightImage || "/placeholder.svg"}
            alt="신호등 캐릭터"
            width={60}
            height={110}
            className="h-[110px] w-auto drop-shadow-lg"
          />
        </div>

        <div className="rounded-3xl border-4 border-blue-400 bg-white px-4 py-2 pr-16">
          <div className="mb-1 flex items-center justify-start gap-8">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-800">정확성</span>
              <span className="text-lg font-bold text-purple-600">{accuracyText}</span>
              <TooltipButton
                active={activeTooltip === "accuracy"}
                onToggle={() => toggleTooltip("accuracy")}
                content="AI 빅데이터와 자막의 논리성 분석을 통해 콘텐츠의 객관적 정확성을 평가"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-800">어그로성</span>
              <span className="text-lg font-bold text-pink-500">{clickbaitText}</span>
              {clickbaitTier && (
                <span className="ml-1 rounded-full border border-pink-200 bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-600">
                  {clickbaitTier}
                </span>
              )}
              <TooltipButton
                active={activeTooltip === "clickbait"}
                onToggle={() => toggleTooltip("clickbait")}
                content="어그로성 점수(높을수록 나쁨): 0~20 일치/마케팅/훅(피해 없음), 21~40 과장(오해/시간적 피해/낚임 수준), 41~60 왜곡(혼란/짜증), 61~100 허위/조작(실질 손실 가능) — 제목/썸네일 vs 본문 불일치(Gap) 기준"
              />
            </div>
          </div>
          <div className="flex items-center justify-center gap-1">
            <span className="text-sm font-bold text-gray-800">신뢰도 점수</span>
            <span className="text-lg font-bold text-pink-500">{trustText}</span>
            <TooltipButton
              active={activeTooltip === "trust"}
              onToggle={() => toggleTooltip("trust")}
              content="신뢰도 계산: (정확성 + (100 - 어그로성))/2"
            />
          </div>

          {recheckDelta && (
            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-black text-slate-700 mb-1">재검 변경사항</div>
              <div className="space-y-1">
                {formatDeltaRow('정확성', recheckDelta.before.accuracy, recheckDelta.after.accuracy, true)}
                {formatDeltaRow('어그로성', recheckDelta.before.clickbait, recheckDelta.after.clickbait, true)}
                {formatDeltaRow('신뢰도', recheckDelta.before.trust, recheckDelta.after.trust, false)}
              </div>
            </div>
          )}

          {prediction && (
            <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-3">
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="font-medium text-gray-600">나의 신뢰도 촉은?</span>
                <span className="text-lg font-bold text-purple-600">{prediction.predictedReliability}</span>
                <span className="font-medium text-gray-600">으로 AI와 오차</span>
                <span className="text-lg font-bold text-orange-600">{prediction.gap}</span>
              </div>
              <div className="text-center text-xs text-gray-500">
                ({prediction.totalPredictions}개 영상) 총 누적 '디지털 eye' 레벨 - 평균 오차 <span className="font-semibold text-blue-600">{prediction.avgGap.toFixed(1)}</span>로
              </div>
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <span className="text-2xl">{prediction.tierEmoji}</span>
                <span className="text-base font-bold text-yellow-600">{prediction.tier}등급</span>
                <span className="text-gray-400">-</span>
                <span className="text-base font-bold text-gray-800">{prediction.tierLabel}</span>
                <span className="text-sm text-gray-600">입니다.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface TTooltipButtonProps {
  active: boolean
  onToggle: () => void
  content: string
}

function TooltipButton({ active, onToggle, content }: TTooltipButtonProps) {
  return (
    <div className="relative">
      <button
        onMouseEnter={onToggle}
        onMouseLeave={onToggle}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[10px] text-gray-500 hover:bg-gray-100"
      >
        ?
      </button>
      {active && (
        <div className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border-2 border-gray-300 bg-white p-3 shadow-lg">
          <p className="text-xs leading-relaxed text-gray-700">{content}</p>
          <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-gray-300 bg-white"></div>
        </div>
      )}
    </div>
  )
}
