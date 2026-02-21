"use client"

import type React from "react"
import { useState } from "react"

import Link from "next/link"
import { Share2, Check } from "lucide-react"

interface THotChannelItem {
  id: string | number
  rank: number
  name: string
  topic: string
  value?: string | number
  score?: number
  views?: string
  videoCount?: number
  color?: string
}

interface THotChannelCardProps {
  item: THotChannelItem
  type: "views" | "trust" | "controversy"
  label?: string
}

export function HotChannelCard({ item, type, label }: THotChannelCardProps) {
  const returnTo = encodeURIComponent('/p-plaza?tab=channel')

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

  const [copied, setCopied] = useState(false)

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/channel/${item.id}`
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile && navigator.share) {
      navigator.share({
        title: item.name,
        text: `${item.name} - ${item.topic} 채널 분석`,
        url: shareUrl,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const displayValue = type === "controversy" ? item.score : item.value

  return (
    <Link
      href={`/channel/${item.id}?returnTo=${returnTo}`}
      className="group flex items-center gap-2 rounded-xl border border-slate-100 bg-white p-2 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md active:scale-[0.99]"
    >
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-sm ${
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
        <h3 className="line-clamp-1 text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors leading-tight">
          {item.name}
        </h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-400">{item.topic}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="text-center">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 leading-none">영상수</span>
            <span className="text-xs font-bold text-slate-600 leading-none tabular-nums">
              {item.videoCount ?? 0}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 leading-none">
                {label || (type === "views" ? "분석수" : "신뢰도")}
            </span>
            <span className={`text-sm font-black leading-none ${getScoreColor()}`}>
                {displayValue}
            </span>
          </div>
        </div>
        <div
          role="button"
          onClick={handleShare}
          className={`p-1 rounded-full transition-all cursor-pointer ${copied ? 'text-green-500 bg-green-50 opacity-100' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover:opacity-100'}`}
          title={copied ? "복사됨" : "공유하기"}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
        </div>
      </div>
    </Link>
  )
}
