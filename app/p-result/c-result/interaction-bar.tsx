"use client"

import { Button } from "@/components/ui/c-button"
import { ThumbsUp, ThumbsDown, Share2 } from "lucide-react"

interface TInteractionBarProps {
  liked: boolean
  disliked: boolean
  likeCount: number
  dislikeCount: number
  onLike: () => void
  onDislike: () => void
  onShare: () => void
}

export function InteractionBar({
  liked,
  disliked,
  likeCount,
  dislikeCount,
  onLike,
  onDislike,
  onShare,
}: TInteractionBarProps) {
  return (
    <div className="flex items-center gap-4 rounded-full border-2 border-gray-300 bg-white p-1.5 px-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={`h-10 w-10 rounded-full ${liked ? "bg-blue-100 text-blue-600 hover:bg-blue-200" : ""}`}
          onClick={onLike}
        >
          <ThumbsUp className="h-5 w-5" />
          <span className="sr-only">좋아요</span>
        </Button>
        <span className="text-sm text-muted-foreground">{likeCount}</span>
      </div>
      <div className="h-6 w-[1px] bg-gray-200" />
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={`h-10 w-10 rounded-full ${disliked ? "bg-red-100 text-red-600 hover:bg-red-200" : ""}`}
          onClick={onDislike}
        >
          <ThumbsDown className="h-5 w-5" />
          <span className="sr-only">싫어요</span>
        </Button>
        <span className="text-sm text-muted-foreground">{dislikeCount}</span>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full border-2 border-blue-400 bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-md hover:shadow-lg transition-all ml-2"
        onClick={onShare}
      >
        <Share2 className="h-5 w-5" />
        <span className="sr-only">공유하기</span>
      </Button>
    </div>
  )
}
