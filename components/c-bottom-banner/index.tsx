"use client"

import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { useEffect, useState } from "react"

export function BottomBanner() {
  const pathname = usePathname()
  const [isClosed, setIsClosed] = useState(false)
  const [adFree, setAdFree] = useState(false)

  useEffect(() => {
    try {
      setIsClosed(window.localStorage.getItem("bottom_banner_ad_closed_v1") === "1")
    } catch {
      // ignore
    }

    const checkAdFree = () => {
      // 확장팩 과금 분석 후 저장된 타임패스를 localStorage에서 직접 확인
      const until = localStorage.getItem('ad_free_until');
      if (until && new Date(until) > new Date()) {
        setAdFree(true)
      } else {
        setAdFree(false)
      }
    }
    checkAdFree()
    window.addEventListener('creditsUpdated', checkAdFree)
    return () => window.removeEventListener('creditsUpdated', checkAdFree)
  }, [])


  // Exclude Home (/), Settings (/settings), and Payment (/payment)
  if (pathname === "/" || pathname === "/settings" || pathname === "/p-settings" || pathname.startsWith("/payment") || pathname.startsWith("/api/payment")) {
    return null
  }

  if (isClosed) return null
  if (adFree) return null

  return (
    <>
      <div className="h-14 xl:hidden" aria-hidden />
      <div className="fixed bottom-0 left-0 right-0 z-50 xl:hidden">
        <div className="h-14 bg-[#1A1A1A]/80 backdrop-blur-md border-t border-white/10">
          <div className="mx-auto flex h-full max-w-[var(--app-max-width)] items-center justify-between px-3 sm:px-4">
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-widest text-white/70">AD</div>
              <div className="truncate text-sm font-bold text-white">광고 영역</div>
            </div>

            <div className="flex items-center gap-2 pl-3">
              <button
                type="button"
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white hover:bg-white/15 active:scale-[0.99] transition"
              >
                자세히
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.localStorage.setItem("bottom_banner_ad_closed_v1", "1")
                  } catch {
                    // ignore
                  }
                  setIsClosed(true)
                }}
                className="h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-[0.99] transition"
                aria-label="광고 닫기"
              >
                <X className="h-3.5 w-3.5 text-white/80" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
