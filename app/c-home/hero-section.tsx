"use client"

import { UrlDisplayBox } from "@/components/c-url-display-box" // Import UrlDisplayBox component
import { AnimatePresence, motion } from "framer-motion"
import { GamifiedLoadingQuiz } from "@/app/c-home/gamified-loading-quiz"

interface THeroSectionProps {
  isAnalyzing: boolean
  isCompleted: boolean
  url: string
}

export function HeroSection({ isAnalyzing, isCompleted, url }: THeroSectionProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-balance text-center text-xl font-bold leading-tight text-[#FF9800] md:text-2xl">
        구독 유튜브 영상/채널: 신뢰도와 순위는?
      </h1>

      <AnimatePresence mode="wait">
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
