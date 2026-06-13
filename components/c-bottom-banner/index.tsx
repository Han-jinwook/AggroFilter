"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { HubBottomBanner } from "@/src/services/merlin-hub-sdk/react"

export function AggroBottomBanner() {
  const pathname = usePathname()
  const [adFree, setAdFree] = useState(false)

  useEffect(() => {
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

  if (pathname?.startsWith('/p-admin')) return null;
  if (pathname?.startsWith('/payment') || pathname?.startsWith('/api/payment')) return null;

  return (
    <HubBottomBanner
      bannerId="aggrofilter_v1"
      hide={adFree}
      actionButton={
        <button
          type="button"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white hover:bg-white/15 active:scale-[0.99] transition"
        >
          자세히
        </button>
      }
    >
      <div className="text-[10px] font-black tracking-widest text-white/70">AD</div>
      <div className="truncate text-sm font-bold text-white">광고 영역</div>
    </HubBottomBanner>
  )
}
