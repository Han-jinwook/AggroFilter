"use client"

import { UrlDisplayBox } from "@/components/c-url-display-box" // Import UrlDisplayBox component
import { AnimatePresence, motion } from "framer-motion"

interface THeroSectionProps {
  isAnalyzing: boolean
  isCompleted: boolean
  url: string
}

export function HeroSection({ isAnalyzing, isCompleted, url }: THeroSectionProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-balance text-center text-xl font-bold leading-tight text-[#FF9800] md:text-2xl">
        낚시 영상에 20분 낭비하지 마세요.<br />
        단 <span className="text-blue-600 text-[1.2em]">10초 만에</span> 결론만 스포일러!
      </h1>

      <AnimatePresence mode="wait">
        {(isAnalyzing || isCompleted) ? (
          <motion.div
            key="video-card"
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
