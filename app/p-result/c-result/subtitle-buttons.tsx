"use client"

import { Button } from "@/components/ui/c-button"
import { ChevronDown, ChevronUp } from "lucide-react"

interface TSubtitleButtonsProps {
  activeSubtitle: "summary" | null
  onToggle: () => void
  chapterCount?: number
}

export function SubtitleButtons({ activeSubtitle, onToggle, chapterCount }: TSubtitleButtonsProps) {
  const buttonText = chapterCount ? `자막 - AI 요약 보기 (${chapterCount}개 챕터)` : "자막 - AI 요약 보기"
  
  return (
    <Button
      variant="outline"
      className={`w-full rounded-full border-2 text-base font-medium transition-colors ${
        activeSubtitle === "summary"
          ? "border-blue-400 bg-blue-300 hover:bg-blue-400"
          : "border-gray-300 bg-slate-200 hover:bg-slate-300"
      }`}
      onClick={onToggle}
    >
      {buttonText}
      {activeSubtitle === "summary" ? (
        <ChevronUp className="ml-2 h-5 w-5 text-blue-700" />
      ) : (
        <ChevronDown className="ml-2 h-5 w-5 text-gray-600" />
      )}
    </Button>
  )
}
