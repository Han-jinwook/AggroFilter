"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Volume2, VolumeX, Type } from "lucide-react"

interface TAccessibilityToolbarProps {
  ttsText: string
  onLargeFontToggle: (enabled: boolean) => void
  largeFontEnabled: boolean
}

export function AccessibilityToolbar({ ttsText, onLargeFontToggle, largeFontEnabled }: TAccessibilityToolbarProps) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false)
    }
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  const handleTTS = useCallback(() => {
    if (!window.speechSynthesis) return

    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause()
      setIsPaused(true)
      return
    }

    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(ttsText)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.9
    utterance.pitch = 1.0

    // 한국어 음성 우선 선택
    const voices = window.speechSynthesis.getVoices()
    const koVoice = voices.find(v => v.lang.startsWith('ko'))
    if (koVoice) utterance.voice = koVoice

    utterance.onend = () => {
      setIsSpeaking(false)
      setIsPaused(false)
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
      setIsPaused(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
    setIsPaused(false)
  }, [ttsText, isSpeaking, isPaused])

  const handleStop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }, [])

  return (
    <div className="flex items-center gap-2">
      {supported && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleTTS}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              isSpeaking
                ? isPaused
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : 'bg-blue-100 text-blue-700 border border-blue-300 animate-pulse'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            }`}
            title={isSpeaking ? (isPaused ? '이어서 듣기' : '일시정지') : '분석 결과 읽어주기'}
          >
            <Volume2 className="h-3.5 w-3.5" />
            {isSpeaking ? (isPaused ? '이어듣기' : '듣는 중...') : '읽어주기'}
          </button>
          {isSpeaking && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all"
              title="읽기 중지"
            >
              <VolumeX className="h-3.5 w-3.5" />
              중지
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => onLargeFontToggle(!largeFontEnabled)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
          largeFontEnabled
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
        }`}
        title={largeFontEnabled ? '기본 글씨로' : '큰 글씨 모드'}
      >
        <Type className="h-3.5 w-3.5" />
        {largeFontEnabled ? '큰 글씨 ON' : '큰 글씨'}
      </button>
    </div>
  )
}
