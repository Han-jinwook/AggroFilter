"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Flame, ShieldCheck, Siren } from "lucide-react"

type TReliabilityTier = "high" | "mid" | "low"

interface TGamifiedLoadingQuizProps {
  url: string
}

function calculateReliability(accuracy: number, clickbait: number) {
  return Math.round((accuracy + (100 - clickbait)) / 2)
}

function getTier(score: number): TReliabilityTier {
  if (score >= 70) return "high"
  if (score >= 40) return "mid"
  return "low"
}

function getTierVisual(tier: TReliabilityTier) {
  if (tier === "high") {
    return {
      title: "청정 채널!",
      subtitle: "팩트 기반일 가능성이 높아요",
      container: "bg-emerald-500/10 border-emerald-200",
      badge: "bg-emerald-600 text-white",
      iconWrap: "bg-emerald-600",
      icon: ShieldCheck,
    }
  }

  if (tier === "mid") {
    return {
      title: "약간 과장됨",
      subtitle: "과장/연출이 섞였을 수 있어요",
      container: "bg-amber-500/10 border-amber-200",
      badge: "bg-amber-500 text-white",
      iconWrap: "bg-amber-500",
      icon: Flame,
    }
  }

  return {
    title: "낚시 주의!",
    subtitle: "제목/썸네일과 내용이 다를 수 있어요",
    container: "bg-rose-500/10 border-rose-200",
    badge: "bg-rose-600 text-white",
    iconWrap: "bg-rose-600",
    icon: Siren,
  }
}

function getYouTubeVideoId(rawUrl: string) {
  try {
    const url = new URL(rawUrl)

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0]
      return id || null
    }

    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v")
      if (v) return v

      const parts = url.pathname.split("/").filter(Boolean)
      const shortsIndex = parts.indexOf("shorts")
      if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1]

      const embedIndex = parts.indexOf("embed")
      if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1]
    }

    return null
  } catch {
    return null
  }
}

function getTrackStyle(kind: "accuracy" | "clickbait", value: number) {
  const fill = Math.max(0, Math.min(100, value))

  const fillColor =
    kind === "accuracy" ? "rgba(16,185,129,1)" : "rgba(244,63,94,1)"
  const baseColor = "rgba(226,232,240,1)"

  return {
    background: `linear-gradient(90deg, ${fillColor} 0%, ${fillColor} ${fill}%, ${baseColor} ${fill}%, ${baseColor} 100%)`,
  } as const
}

function vibrateTick() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10)
    }
  } catch {
    // ignore
  }
}

export function GamifiedLoadingQuiz({ url }: TGamifiedLoadingQuizProps) {
  const [accuracy, setAccuracy] = useState(60)
  const [clickbait, setClickbait] = useState(35)
  const [submitted, setSubmitted] = useState(false)
  const [touchedSliders, setTouchedSliders] = useState({ accuracy: false, clickbait: false })

  const score = useMemo(() => calculateReliability(accuracy, clickbait), [accuracy, clickbait])
  const tier = useMemo(() => getTier(score), [score])
  const visual = useMemo(() => getTierVisual(tier), [tier])
  const videoId = useMemo(() => getYouTubeVideoId(url), [url])

  const thumbSrc = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null

  const Icon = visual.icon

  const handleSubmit = async () => {
    const payload = {
      url,
      accuracy,
      clickbait,
      predictedReliability: score,
      submittedAt: Date.now(),
    }

    try {
      window.sessionStorage.setItem("prediction_quiz_v1", JSON.stringify(payload))
    } catch {
      // ignore
    }

    setSubmitted(true)
    vibrateTick()
  }

  const handleSliderRelease = (type: 'accuracy' | 'clickbait') => {
    const newTouched = { ...touchedSliders, [type]: true }
    setTouchedSliders(newTouched)

    if (newTouched.accuracy && newTouched.clickbait && !submitted) {
      setTimeout(() => handleSubmit(), 300)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.25 }}
      className="space-y-3"
    >
      <motion.div
        className="text-center"
        animate={{ opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="text-sm font-black text-slate-900">AI가 영상을 분석하고 있습니다...</div>
        <div className="mt-1 text-[11px] font-semibold text-slate-500">10초 동안 당신의 촉을 시험해보세요</div>
      </motion.div>

      <div className="rounded-3xl border border-white/20 bg-white/45 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] backdrop-blur-xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-orange-400 via-red-500 to-pink-500" />
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-slate-900">분석 중인 영상</div>
            <div className="text-[10px] font-black tracking-widest text-slate-700 rounded-full bg-slate-900/5 px-2 py-1">
              QUIZ
            </div>
          </div>

          <div className="mt-2 overflow-hidden rounded-2xl border border-white/30 bg-white">
            {thumbSrc ? (
              <div className="relative aspect-video w-full">
                <Image src={thumbSrc} alt="Video thumbnail" fill className="object-cover" unoptimized />
              </div>
            ) : (
              <div className="aspect-video w-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <div className="text-xs font-bold text-slate-500">THUMBNAIL</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-center">
          <div className="text-sm font-black text-slate-900">당신의 촉은 몇 점인가요?</div>
          <div className="mt-1 text-[11px] font-semibold text-slate-500">슬라이더를 움직이면 예상 신뢰도가 즉시 계산돼요</div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-black text-slate-900">정확성</div>
                <div className="text-[11px] font-semibold text-slate-500">내용이 팩트에 가까운가요?</div>
              </div>
              <motion.div
                key={accuracy}
                initial={{ scale: 0.92, y: 2, opacity: 0.7 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="text-2xl font-black text-slate-900 tabular-nums"
              >
                {accuracy}
              </motion.div>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              value={accuracy}
              onChange={(e) => {
                setSubmitted(false)
                setAccuracy(Number(e.target.value))
              }}
              onPointerUp={() => {
                vibrateTick()
                handleSliderRelease('accuracy')
              }}
              className="mt-2 w-full appearance-none h-3 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-300 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform active:[&::-webkit-slider-thumb]:scale-95 [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-300 [&::-moz-range-thumb]:shadow-md"
              style={getTrackStyle("accuracy", accuracy)}
            />
          </div>

          <div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-black text-slate-900">어그로성</div>
                <div className="text-[11px] font-semibold text-slate-500">제목/썸네일이 내용과 다른가요?</div>
              </div>
              <motion.div
                key={clickbait}
                initial={{ scale: 0.92, y: 2, opacity: 0.7 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="text-2xl font-black text-slate-900 tabular-nums"
              >
                {clickbait}
              </motion.div>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              value={clickbait}
              onChange={(e) => {
                setSubmitted(false)
                setClickbait(Number(e.target.value))
              }}
              onPointerUp={() => {
                vibrateTick()
                handleSliderRelease('clickbait')
              }}
              className="mt-2 w-full appearance-none h-3 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-300 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform active:[&::-webkit-slider-thumb]:scale-95 [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-300 [&::-moz-range-thumb]:shadow-md"
              style={getTrackStyle("clickbait", clickbait)}
            />
          </div>
        </div>
      </div>

      <motion.div
        layout
        className={`rounded-3xl border p-4 shadow-sm ${visual.container}`}
        animate={{ scale: [1, 1.01, 1] }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center gap-3">
          <div className={`h-11 w-11 rounded-2xl ${visual.iconWrap} text-white flex items-center justify-center shadow-sm`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-black text-slate-900 truncate">{visual.title}</div>
              <div className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black tracking-widest ${visual.badge}`}>
                {score}
              </div>
            </div>
            <div className="mt-1 text-[11px] font-semibold text-slate-600">{visual.subtitle}</div>
          </div>
        </div>
      </motion.div>

      <div className="pb-1">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          className={
            "w-full rounded-2xl px-4 py-3 text-sm font-black shadow-sm transition-all " +
            (submitted ? "bg-slate-900/10 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-900/95")
          }
          aria-label="내 예측 점수 제출하기"
        >
          <span className="inline-flex items-center justify-center gap-2">
            {submitted ? <Check className="h-4 w-4" /> : null}
            {submitted ? "제출 완료" : "내 예측 점수 제출하기"}
          </span>
        </motion.button>

        <AnimatePresence>
          {!submitted ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="mt-2 text-center text-[11px] font-semibold text-slate-500"
            >
              예상 신뢰도 = (정확성 + (100 - 어그로성)) / 2
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
