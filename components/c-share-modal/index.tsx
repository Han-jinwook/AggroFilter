"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/c-dialog"
import { Copy, Check, MessageCircle, Send, Link2, X } from "lucide-react"

interface TShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  url: string
}

export function ShareModal({ open, onOpenChange, title, description, url }: TShareModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const textarea = document.createElement("textarea")
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyText = async () => {
    const text = `${title}\n\n${description}\n\n${url}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const shareToKakao = () => {
    const kakaoUrl = `https://story.kakao.com/share?url=${encodeURIComponent(url)}`
    window.open(kakaoUrl, "_blank", "width=600,height=400")
  }

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}\n${description}`)}&url=${encodeURIComponent(url)}`
    window.open(twitterUrl, "_blank", "width=600,height=400")
  }

  const shareToFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    window.open(fbUrl, "_blank", "width=600,height=400")
  }

  const shareToLine = () => {
    const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`
    window.open(lineUrl, "_blank", "width=600,height=400")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">공유하기</h3>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{title}</p>
        </div>

        {/* Share Buttons Grid */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-4 gap-4">
            {/* KakaoTalk */}
            <button onClick={shareToKakao} className="flex flex-col items-center gap-1.5 group">
              <div className="w-12 h-12 rounded-full bg-[#FEE500] flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow group-active:scale-95 transition-transform">
                <MessageCircle className="w-6 h-6 text-[#3C1E1E]" />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">카카오톡</span>
            </button>

            {/* X (Twitter) */}
            <button onClick={shareToTwitter} className="flex flex-col items-center gap-1.5 group">
              <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow group-active:scale-95 transition-transform">
                <span className="text-white font-bold text-lg">𝕏</span>
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">X</span>
            </button>

            {/* Facebook */}
            <button onClick={shareToFacebook} className="flex flex-col items-center gap-1.5 group">
              <div className="w-12 h-12 rounded-full bg-[#1877F2] flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow group-active:scale-95 transition-transform">
                <span className="text-white font-bold text-lg">f</span>
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Facebook</span>
            </button>

            {/* LINE */}
            <button onClick={shareToLine} className="flex flex-col items-center gap-1.5 group">
              <div className="w-12 h-12 rounded-full bg-[#06C755] flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow group-active:scale-95 transition-transform">
                <Send className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">LINE</span>
            </button>
          </div>
        </div>

        {/* Copy Section */}
        <div className="px-5 pb-5 space-y-2">
          {/* URL Copy */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="flex-1 text-sm text-gray-600 dark:text-gray-300 truncate text-left">{url}</span>
            <div className="flex-shrink-0">
              {copied ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Copy className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              )}
            </div>
          </button>

          {/* Full Text Copy */}
          <button
            onClick={handleCopyText}
            className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            설명 포함 복사
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
