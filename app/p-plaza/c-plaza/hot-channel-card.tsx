"use client"

import type React from "react"

import Link from "next/link"
import { Share2 } from "lucide-react"

interface THotChannelItem {
  id: string | number
  rank: number
  name: string
  topic: string
  value?: string | number
  score?: number
  views?: string
  color?: string
}

interface THotChannelCardProps {
  item: THotChannelItem
  type: "views" | "trust" | "controversy"
  label?: string
}

export function HotChannelCard({ item, type, label }: THotChannelCardProps) {
  const getScoreColor = () => {
    if (item.color === "green") return "text-green-500"
    if (item.color === "red") return "text-red-500"
    if (item.color === "orange") return "text-orange-500"
    if (item.color === "blue") return "text-blue-600"
    
    // Fallback logic if color is not provided
    const score = item.score || Number(item.value) || 0
    if (type === "controversy") {
      if (score >= 80) return "text-red-500"
      if (score <= 40) return "text-green-500"
      return "text-amber-500"
    }
    if (score >= 80) return "text-green-500"
    if (score <= 40) return "text-red-500"
    return "text-amber-500"
  }

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (navigator.share) {
      navigator.share({
        title: item.name,
        text: `${item.name} - ${item.topic} 채널 분석`,
        url: `${window.location.origin}/channel/${item.id}`,
      })
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/channel/${item.id}`)
      alert("링크가 복사되었습니다!")
    }
  }

  const displayValue = type === "controversy" ? item.score : item.value

  return (
    <Link
      href={`/channel/${item.id}`}
      className="group flex items-center gap-2.5 rounded-2xl border-2 border-slate-100 bg-white p-2.5 transition-all hover:-translate-y-1 hover:border-slate-200 hover:shadow-lg active:scale-[0.99]"
    >
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-base font-black text-white shadow-md ${
          item.rank === 1
            ? "bg-gradient-to-br from-purple-400 to-indigo-500 ring-2 ring-purple-100"
            : item.rank === 2
              ? "bg-gradient-to-br from-purple-300 to-indigo-400"
              : "bg-gradient-to-br from-slate-400 to-slate-500"
        }`}
      >
        {item.rank}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
          {item.name}
        </h3>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-400">{item.topic}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-400">
                {label || (type === "views" ? "분석수" : "신뢰도")}
            </span>
            <span className={`text-base font-black ${getScoreColor()}`}>
                {displayValue}
            </span>
          </div>
        </div>
        <div
          role="button"
          onClick={handleShare}
          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          title="공유하기"
        >
          <Share2 className="h-4 w-4" />
        </div>
      </div>
    </Link>
  )
}
