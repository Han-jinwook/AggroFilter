"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/c-dialog"
import { Copy, Check, X, ShieldAlert, FileText } from "lucide-react"
import { toast } from "sonner"

interface TTranscriptCopyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  analysisId?: string
  videoTitle?: string
  initialTranscript?: string | null
}

export function TranscriptCopyModal({
  open,
  onOpenChange,
  analysisId,
  videoTitle = "영상",
  initialTranscript,
}: TTranscriptCopyModalProps) {
  const [agreed, setAgreed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setAgreed(false)
      setCopied(false)
      setLoading(false)
    }
  }, [open])

  const handleCopy = async () => {
    if (!agreed || loading) return

    setLoading(true)
    try {
      let text = initialTranscript

      // 만약 초기 transcript가 없거나 빈 값이면 온디맨드로 fetch
      if (!text || text.trim().length === 0) {
        if (analysisId) {
          const res = await fetch(`/api/analysis/result/${analysisId}`, { cache: "no-store" })
          if (res.ok) {
            const data = await res.json()
            text = data.analysisData?.fullSubtitle || data.analysisData?.summarySubtitle || ""
          }
        }
      }

      if (!text || text.trim().length === 0) {
        toast.error("복사할 대본 데이터를 불러오지 못했습니다.")
        setLoading(false)
        return
      }

      try {
        await navigator.clipboard.writeText(text)
      } catch {
        const textarea = document.createElement("textarea")
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }

      setCopied(true)
      toast.success("대본이 클립보드에 복사되었습니다! 필요한 곳에 붙여넣기(Ctrl+V)하세요.")
      setTimeout(() => {
        onOpenChange(false)
      }, 700)
    } catch (err) {
      console.error("대본 복사 에러:", err)
      toast.error("클립보드 복사 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 rounded-3xl overflow-hidden border-2 border-teal-200">
        {/* Header */}
        <div className="bg-teal-50 px-5 pt-5 pb-4 border-b border-teal-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <FileText className="h-4 w-4" />
              </span>
              <h3 className="text-lg font-black text-gray-900">영상 원본 대본 복사</h3>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-600 line-clamp-1 font-medium">{videoTitle}</p>
        </div>

        {/* Notice & Terms */}
        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-950 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span>저작권 및 이용 시 주의 안내</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px] font-medium leading-normal">
              <li>본 대본은 영상의 팩트체크 검증 및 개인 학습·연구 참고 목적으로만 제공됩니다.</li>
              <li>
                본 데이터의 저작권은 <strong className="text-gray-900">원 영상 제작자</strong>에게 있으며, 무단 상업적 재배포 및 2차 가공 시 발생하는 모든 법적 책임은 사용자에게 있습니다.
              </li>
            </ul>
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-gray-800 leading-snug">
              위 저작권 및 이용 주의사항을 확인하였으며, 개인 학습·참고 목적으로만 활용하겠습니다. <span className="text-teal-600 font-bold">(필수)</span>
            </span>
          </label>

          {/* Action Button */}
          <button
            onClick={handleCopy}
            disabled={!agreed || loading}
            className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
              agreed && !loading
                ? "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 active:scale-98 cursor-pointer"
                : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-white" />
                <span>클립보드 복사 완료!</span>
              </>
            ) : loading ? (
              <span>대본 불러오는 중...</span>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>{agreed ? "클립보드에 대본 복사하기" : "주의사항 확인 후 복사 가능"}</span>
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
