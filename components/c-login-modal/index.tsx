"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/c-button"
import { Input } from "@/components/ui/c-input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/c-dialog"

interface TLoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoginSuccess: (email: string) => void
}

export function LoginModal({ open, onOpenChange, onLoginSuccess }: TLoginModalProps) {
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    // TODO: 백엔드 API - 인증코드 이메일 발송
    console.log("인증코드 발송:", email)

    setTimeout(() => {
      setIsLoading(false)
      setStep("code")
    }, 1000)
  }

  const handleCodeChange = (index: number, value: string) => {
    // 숫자만 입력 가능
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // 자동 다음 칸 포커스
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`)
      nextInput?.focus()
    }

    // 6자리 모두 입력되면 자동 로그인
    if (newCode.every((digit) => digit !== "") && newCode.join("").length === 6) {
      handleLogin(newCode.join(""))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleLogin = async (verificationCode: string) => {
    setIsLoading(true)
    // TODO: 백엔드 API - 인증코드 확인
    console.log("인증코드 확인:", verificationCode)

    setTimeout(() => {
      setIsLoading(false)
      onLoginSuccess(email)
      onOpenChange(false)
      // 상태 초기화
      setStep("email")
      setEmail("")
      setCode(["", "", "", "", "", ""])
    }, 500)
  }

  const handleResendCode = () => {
    // TODO: 백엔드 API - 인증코드 재발송
    console.log("인증코드 재발송:", email)
    alert("인증코드가 재발송되었습니다.")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-blue-600 dark:text-blue-400">
            AggroFilter
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground">로그인하고 분석을 시작하세요</p>
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
                {isLoading ? "발송 중..." : "인증코드 받기"}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">인증코드 입력</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("email")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    이메일 변경
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{email}로 발송된 6자리 코드를 입력하세요</p>
              </div>

              <div className="flex gap-2 justify-center">
                {code.map((digit, index) => (
                  <Input
                    key={index}
                    id={`code-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="h-14 w-12 text-center text-xl font-semibold"
                  />
                ))}
              </div>

              <Button
                variant="ghost"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={handleResendCode}
              >
                인증코드 재전송
              </Button>
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
