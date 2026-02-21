"use client"

import type React from "react"
import { useState } from "react"

import Link from "next/link"
import { Share2, Check } from "lucide-react"

interface THotIssueItem {
  id: string | number
  rank: number
  title: string
  channel: string
  topic?: string
  views?: string
  analysis_count?: number
  score: number
}

interface THotIssueCardProps {
  item: THotIssueItem
  type: "views" | "trust" | "aggro"
}

export function HotIssueCard({ item, type }: THotIssueCardProps) {
  const getScoreColor = () => {
    if (type === "aggro") {
      if (item.score >= 80) return "text-red-500"
      if (item.score <= 40) return "text-green-500"
      return "text-amber-500"
    }
    if (item.score >= 80) return "text-green-500"
    if (item.score <= 40) return "text-red-500"
    return "text-amber-500"
  }

  const [copied, setCopied] = useState(false)

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/p-result?id=${item.id}`
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile && navigator.share) {
      navigator.share({
        title: item.title,
        text: `${item.channel}의 "${item.title}" - 신뢰도 ${item.score}점`,
        url: shareUrl,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Link
      href={`/p-result?id=${item.id}`}
      className="group flex items-center gap-2 rounded-xl border border-slate-100 bg-white p-2 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md active:scale-[0.99]"
    >
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-sm ${
          item.rank === 1
            ? "bg-gradient-to-br from-orange-400 to-red-500 ring-2 ring-orange-100"
            : item.rank === 2
              ? "bg-gradient-to-br from-orange-300 to-orange-500"
              : "bg-gradient-to-br from-slate-400 to-slate-500"
        }`}
      >
        {item.rank}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
          {item.title}
        </h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-600">{item.channel}</span>
          {item.topic && (
            <>
              <span className="h-2.5 w-[1px] bg-slate-200" />
              <span className="text-slate-400">{item.topic}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="text-right">
          {type === "views" && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] font-bold text-slate-400 leading-none">분석수</span>
              <span className="text-sm font-black text-slate-800 leading-none">{item.analysis_count || 0}</span>
            </div>
          )}
          {(type === "trust" || type === "aggro") && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] font-bold text-slate-400 leading-none">{type === "trust" ? "신뢰도" : "어그로"}</span>
              <span className={`text-sm font-black leading-none ${getScoreColor()}`}>{item.score}</span>
            </div>
          )}
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
