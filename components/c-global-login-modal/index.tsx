"use client"

import { useState, useEffect } from "react"
import { LoginModal } from "@/components/c-login-modal"

export function GlobalLoginModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("openLoginModal", handler)
    return () => window.removeEventListener("openLoginModal", handler)
  }, [])

  return (
    <LoginModal
      open={open}
      onOpenChange={setOpen}
      onLoginSuccess={(email: string, userId: string) => {
        if (email) localStorage.setItem('userEmail', email)
        if (userId) localStorage.setItem('userId', userId)
        setOpen(false)
        window.location.reload()
      }}
    />
  )
}
