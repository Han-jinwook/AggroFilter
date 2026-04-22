"use client"

import { useState, useEffect } from "react"
import { LoginModal } from "@/components/c-login-modal"

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
    <LoginModal
      open={open}
      onOpenChange={setOpen}
      // REFACTORED_BY_MERLIN_HUB: SDK가 merlin_session_token + merlin_family_uid 자동 저장
      onLoginSuccess={async (email: string, _userId: string) => {
        if (email) localStorage.setItem('userEmail', email)
        setOpen(false)
        window.location.reload()
      }}
    />
  )
}
