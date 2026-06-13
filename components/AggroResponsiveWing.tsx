"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { HubResponsiveWing } from "@/src/services/merlin-hub-sdk/react"

export function AggroResponsiveWing() {
  const pathname = usePathname()
  const [adFree, setAdFree] = useState(false)

  useEffect(() => {
    const checkAdFree = () => {
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

  let customTitle = "어그로필터 - 가짜 유튜브 영상 분석기";
  if (pathname?.startsWith('/p-result/')) {
    customTitle = "[어그로필터] 충격적인 이 영상의 신뢰도 점수는?";
  }

  // TODO: 실제 구글 애드센스 계정 세팅 시 ID를 교체하세요.
  const googleAdClient = "ca-pub-xxxxxxxxxxxx"
  const sideAdSlot = "1111111111"
  const bottomAdSlot = "2222222222"

  return (
    <HubResponsiveWing
      bannerId="aggrofilter_v2"
      hide={adFree}
      shareTitle={customTitle}
      shareDescription="공유 링크에는 내 추천인 코드가 포함되어 전달됩니다."
      adClient={googleAdClient}
      sideAdSlot={sideAdSlot}
      bottomAdSlot={bottomAdSlot}
      bottomActionButton={
        <button
          type="button"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white hover:bg-white/15 active:scale-[0.99] transition"
        >
          자세히
        </button>
      }
    />
  )
}
