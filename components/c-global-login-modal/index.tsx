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
      onLoginSuccess={(_email: string, _userId: string) => {
        setOpen(false)
        window.location.reload()
      }}
    />
  )
}
