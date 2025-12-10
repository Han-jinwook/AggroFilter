"use client"

import { ArrowRight } from "lucide-react" // Fixed import paths - using lucide-react for ArrowRight icon
import { UrlDisplayBox } from "@/components/url-display-box" // Import UrlDisplayBox component

interface HeroSectionProps {
  url: string
  isAnalyzing: boolean
  isCompleted: boolean
  onUrlChange: (url: string) => void
  onAnalyze: () => void
}

export function HeroSection({ url, isAnalyzing, isCompleted, onUrlChange, onAnalyze }: HeroSectionProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-balance text-center text-xl font-bold leading-tight text-[#FF9800] md:text-2xl">
        구독 유튜브 영상/채널: 신뢰도와 순위는?
      </h1>

      {!isAnalyzing && !isCompleted ? (
        <div className="relative">
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
        </div>
      ) : (
        <UrlDisplayBox url={url} />
      )}
    </div>
  )
}
