"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/c-button"
import { Input } from "@/components/ui/c-input"
import { Dialog, DialogContent } from "@/components/ui/c-dialog"
import { requestOTP, verifyOTP } from "@/src/services/merlin-hub-sdk"

interface TLoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoginSuccess: (email: string, userId: string) => void
}

export function LoginModal({ open, onOpenChange, onLoginSuccess }: TLoginModalProps) {
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [error, setError] = useState("")
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setError("")
    setIsLoading(true)
    try {
      const result = await requestOTP(email)
      if (!result.success) throw new Error(result.error || 'Failed to send OTP')
      setStep("code")
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || '코드 발송에 실패했습니다. 이메일을 확인해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    setError("")
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    if (newCode.every(d => d !== "") && newCode.join("").length === 6) {
      verifyCode(newCode.join(""))
    }
  }

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleCodePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted.length === 6) {
      const newCode = pasted.split("")
      setCode(newCode)
      verifyCode(pasted)
    }
  }

  const verifyCode = async (fullCode: string) => {
    setIsLoading(true)
    setError("")
    try {
      const result = await verifyOTP(email, fullCode, 'AGGRO_FILTER')
      if (!result.success) {
        setError(result.error || '코드가 올바르지 않거나 만료되었습니다.')
        setCode(["", "", "", "", "", ""])
        setTimeout(() => inputRefs.current[0]?.focus(), 50)
        return
      }

      if (result.email) localStorage.setItem('userEmail', result.email)
      if (result.nickname) localStorage.setItem('userNickname', result.nickname)
      if (result.referral_code) localStorage.setItem('userReferralCode', result.referral_code)
      
      onLoginSuccess(result.email || email, result.userId || '')
    } catch (err) {
      console.error(err)
      setError('인증에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email) return
    setIsLoading(true)
    setError("")
    setCode(["", "", "", "", "", ""])
    try {
      const result = await requestOTP(email)
      if (!result.success) throw new Error(result.error || 'Failed')
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || '재발송에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("email")
      setEmail("")
      setCode(["", "", "", "", "", ""])
      setError("")
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] rounded-[3rem]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="px-8 pt-12 pb-10">
          {step === "email" ? (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="flex flex-col items-center gap-6 mb-10">
                <div className="space-y-4 text-center">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
                    <img
                      src={`/images/character-logo-ko.png?v=${Date.now()}`}
                      alt="어그로필터"
                      className="h-10 w-auto object-contain"
                    />
                    시작하기
                  </h2>
                  <p className="text-[15px] text-slate-400 font-bold tracking-tight">
                    지금 바로 무료 코인 받아 분석에 사용하세요
                  </p>
                </div>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <Input
                  id="email"
                  type="email"
                  placeholder="이메일 주소 입력 (example@email.com)"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError("") }}
                  required
                  className="h-16 bg-slate-50 border-2 border-slate-100 focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all rounded-2xl text-lg font-bold px-6 text-center"
                />

                {error && (
                  <div className="bg-red-50 text-red-500 text-sm font-bold py-4 px-6 rounded-2xl border border-red-100 text-center">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all" 
                  disabled={isLoading}
                >
                  {isLoading ? "준비 중..." : "인증코드 받기"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center space-y-10">
              <div className="space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-2">
                  <span className="text-3xl">📧</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">인증코드를 입력해주세요</h3>
                <p className="text-base text-slate-400 font-bold">
                  <span className="text-blue-600 font-black">{email}</span>로<br/>
                  6자리 코드를 발송했습니다.
                </p>
              </div>

              <div className="flex justify-center gap-3" onPaste={handleCodePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleCodeChange(i, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(i, e)}
                    className={`w-12 h-16 text-center text-3xl font-black border-3 rounded-2xl outline-none transition-all ${
                      digit 
                        ? 'border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-500/10' 
                        : 'border-slate-200 bg-white text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/5'
                    }`}
                    disabled={isLoading}
                  />
                ))}
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleResend} 
                    disabled={isLoading}
                    className="h-14 border-2 border-slate-100 text-slate-600 font-black text-base rounded-xl hover:bg-slate-50 hover:border-slate-200 transition-all"
                  >
                    🔄 인증코드 재발송
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => { setStep("email"); setCode(["", "", "", "", "", ""]); setError("") }}
                    className="h-12 text-slate-400 font-bold text-sm hover:text-slate-600 hover:bg-transparent"
                  >
                    다른 이메일 주소 사용하기
                  </Button>
                </div>

                <div className="pt-4 border-top border-slate-50">
                  <p className="text-xs text-slate-400 font-bold tracking-tight">
                    통합계정센터 <span className="text-slate-300 mx-1">|</span> <span className="text-slate-500">os.sundreamer.app</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mt-8">
            <span className="text-[11px] text-slate-200 font-bold tracking-tight">
              시작 시 서비스 정책에 동의하게 됩니다.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
