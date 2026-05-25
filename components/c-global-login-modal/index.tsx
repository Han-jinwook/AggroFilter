"use client"

import { useState, useEffect } from "react"
import { HubAuthModal, HubBenefitModal } from "@/src/services/merlin-hub-sdk/react"

export function GlobalLoginModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("openLoginModal", handler)
    window.addEventListener("merlinSessionExpired", handler)
    return () => {
      window.removeEventListener("openLoginModal", handler)
      window.removeEventListener("merlinSessionExpired", handler)
    }
  }, [])

  return (
    <>
      <HubBenefitModal 
        customBenefitTitle="관심 채널 신뢰도 변동 알림"
        customBenefitDesc="관심 채널 신뢰도 단계(그린/옐로/레드)가 바뀌면 바로 알림"
        customBenefitIcon="🔔"
      />
      <HubAuthModal
        isOpen={open}
        onClose={() => setOpen(false)}
        // REFACTORED_BY_MERLIN_HUB: SDK가 merlin_session_token + merlin_user_id 자동 저장
        onSuccess={async (email?: string, _userId?: string) => {
          if (email) localStorage.setItem('userEmail', email)
          setOpen(false)
          window.location.reload()
        }}
        appName="어그로필터" 
        appLogoUrl="/images/character-logo-ko.png" 
        subtitleActionText="분석에" 
      />
    </>
  )
}
