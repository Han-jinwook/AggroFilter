"use client"

import { ArrowRight } from "lucide-react" // Fixed import paths - using lucide-react for ArrowRight icon
import { UrlDisplayBox } from "@/components/c-url-display-box" // Import UrlDisplayBox component
import { AnimatePresence, motion } from "framer-motion"
import { GamifiedLoadingQuiz } from "@/app/c-home/gamified-loading-quiz"

interface THeroSectionProps {
  url: string
  isAnalyzing: boolean
  isCompleted: boolean
  onUrlChange: (url: string) => void
  onAnalyze: () => void
}

export function HeroSection({ url, isAnalyzing, isCompleted, onUrlChange, onAnalyze }: THeroSectionProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-balance text-center text-xl font-bold leading-tight text-[#FF9800] md:text-2xl">
        구독 유튜브 영상/채널: 신뢰도와 순위는?
      </h1>

      <AnimatePresence mode="wait">
        {!isAnalyzing && !isCompleted ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <input
              type="text"
              placeholder="유튜브 URL 복사/붙여넣기 (PC: 북마크 클릭)"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onAnalyze()
                }
              }}
              className="w-full rounded-3xl border-4 border-black bg-background px-6 py-4 pr-14 text-center text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF9800]/50"
            />
            {url.trim() && (
              <button
                onClick={onAnalyze}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#E57373] p-2.5 text-white shadow-lg transition-all hover:bg-[#E57373]/90 hover:shadow-xl"
                title="분석 시작 (Enter)"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </motion.div>
        ) : null}

        {isAnalyzing ? (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <GamifiedLoadingQuiz url={url} />
          </motion.div>
        ) : null}

        {!isAnalyzing && isCompleted ? (
          <motion.div
            key="completed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <UrlDisplayBox url={url} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
