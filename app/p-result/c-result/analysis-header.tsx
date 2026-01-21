"use client"

import Image from "next/image"
import { Button } from "@/components/ui/c-button"
import { ChevronLeft } from "lucide-react"

interface TAnalysisHeaderProps {
  channelImage: string
  channelName: string
  title: string
  videoUrl: string
  date: string
  onBack: () => void
  onChannelClick: () => void
  onHeaderClick?: () => void
}

export function AnalysisHeader({ 
  channelImage, 
  channelName, 
  title, 
  videoUrl, 
  date, 
  onBack, 
  onChannelClick,
  onHeaderClick 
}: TAnalysisHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
          <ChevronLeft className="h-8 w-8" />
          <span className="sr-only">뒤로 가기</span>
        </Button>

        <div 
          onClick={onHeaderClick}
          className="flex items-center gap-3 rounded-3xl border-4 border-black bg-white px-3 py-2 flex-1 max-w-md h-[4.5rem] overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <Image
            src={channelImage || "/placeholder.svg"}
            alt={channelName}
            width={50}
            height={50}
            className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
          />
          <div className="flex flex-col justify-center overflow-hidden">
            <p className="text-sm font-bold leading-tight truncate">{title}</p>
            <p className="text-xs text-gray-500 truncate">{channelName}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={onChannelClick}
            className="rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 h-auto whitespace-nowrap"
          >
            채널랭킹 &gt;
          </Button>
          <p className="text-sm text-muted-foreground text-right">{date.split(" . ")[0]}</p>
        </div>
      </div>
    </div>
  )
}
