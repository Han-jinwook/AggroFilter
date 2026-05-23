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
}

export function InteractionBar({
  liked,
  disliked,
  likeCount,
  dislikeCount,
  onLike,
  onDislike,
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
    </div>
  )
}
