"use client"

import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"

interface SubtitleButtonsProps {
  activeSubtitle: "full" | "summary" | null
  onToggle: (type: "full" | "summary") => void
}

export function SubtitleButtons({ activeSubtitle, onToggle }: SubtitleButtonsProps) {
  return (
    <div className="flex gap-3">
      <Button
        variant="outline"
        className={`flex-1 rounded-full border-2 py-6 text-base font-medium transition-colors ${
          activeSubtitle === "full"
            ? "border-blue-400 bg-blue-300 hover:bg-blue-400"
            : "border-gray-300 bg-slate-200 hover:bg-slate-300"
        }`}
        onClick={() => onToggle("full")}
      >
        자막 전문 보기
        {activeSubtitle === "full" ? (
          <ChevronUp className="ml-2 h-5 w-5 text-blue-700" />
        ) : (
          <ChevronDown className="ml-2 h-5 w-5 text-gray-600" />
        )}
      </Button>
      <Button
        variant="outline"
        className={`flex-1 rounded-full border-2 py-6 text-base font-medium transition-colors ${
          activeSubtitle === "summary"
            ? "border-blue-400 bg-blue-300 hover:bg-blue-400"
            : "border-gray-300 bg-slate-200 hover:bg-slate-300"
        }`}
        onClick={() => onToggle("summary")}
      >
        자막 요약 보기
        {activeSubtitle === "summary" ? (
          <ChevronUp className="ml-2 h-5 w-5 text-blue-700" />
        ) : (
          <ChevronDown className="ml-2 h-5 w-5 text-gray-600" />
        )}
      </Button>
    </div>
  )
}
