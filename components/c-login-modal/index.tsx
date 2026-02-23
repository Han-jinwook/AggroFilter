"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/c-button"
import { Input } from "@/components/ui/c-input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/c-dialog"

interface TLoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoginSuccess: (email: string, userId: string) => void
}

export function LoginModal({ open, onOpenChange, onLoginSuccess }: TLoginModalProps) {
  const [step, setStep] = useState<"email" | "sent">("email")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send link')
      setStep("sent")
    } catch (error) {
      console.error(error);
      alert('링크 발송에 실패했습니다. 이메일을 확인해주세요.');
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email) return;
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      alert('링크가 재발송되었습니다.')
    } catch (error) {
      console.error(error);
      alert('재발송에 실패했습니다.');
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-blue-600 dark:text-blue-400">
            AggroFilter
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground">이메일을 등록하면 알림과 데이터 보존이 가능해요</p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  이메일 주소
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading ? "발송 중..." : "로그인 링크 받기"}
              </Button>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <div className="text-4xl">📧</div>
              <div className="space-y-2">
                <p className="font-semibold text-slate-800">이메일을 확인해주세요</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-blue-600">{email}</span>로<br />
                  로그인 링크를 발송했습니다.<br />
                  링크를 클릭하면 바로 로그인됩니다.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                  onClick={handleResend}
                  disabled={isLoading}
                >
                  {isLoading ? "발송 중..." : "링크 재발송"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setStep("email"); setEmail("") }}
                  className="text-xs text-muted-foreground"
                >
                  이메일 변경
                </Button>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            로그인하시면 이용약관 및 개인정보처리방침에 동의하게 됩니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
