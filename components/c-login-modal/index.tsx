"use client"

import type React from "react"
import Image from "next/image"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/c-button"
import { Input } from "@/components/ui/c-input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/c-dialog"
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
      // REFACTORED: 추천인 코드는 추후 공유 링크를 통해 자동 처리되므로 빈 값 전달
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
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* 상단 장식용 배경 */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-blue-600/10 to-indigo-600/5 -z-10" />
        
        <div className="px-8 pt-10 pb-12">
          <DialogHeader className="flex flex-col items-center gap-4 mb-8">
            <div className="relative w-48 h-12 mb-2">
              <Image
                src="/images/character-logo.png"
                alt="AggroFilter"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="space-y-2 text-center">
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
                어그로필터에 오신 것을 환영합니다! 🎉
              </DialogTitle>
              <p className="text-sm text-slate-500 font-medium leading-relaxed px-4">
                지금 가입하시면 증정되는 <span className="text-blue-600 font-bold">무료 분석 코인</span>으로<br />
                유튜브 정밀 분석을 바로 시작해보세요.
              </p>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div className="space-y-2.5">
                  <label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                    이메일 주소
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError("") }}
                    required
                    className="h-14 bg-slate-50/50 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all rounded-2xl text-base px-5"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-500 text-xs font-bold py-3 px-4 rounded-xl border border-red-100 text-center animate-in fade-in slide-in-from-top-1">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>발송 중...</span>
                    </div>
                  ) : "인증코드 받기"}
                </Button>
              </form>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="text-center space-y-2">
                  <p className="font-bold text-slate-800">📧 인증코드를 입력해주세요</p>
                  <p className="text-sm text-slate-500 font-medium">
                    <span className="text-blue-600 font-bold">{email}</span>로<br />
                    6자리 코드를 발송했습니다.
                  </p>
                </div>

                <div className="flex justify-center gap-2.5" onPaste={handleCodePaste}>
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
                      className={`w-12 h-16 text-center text-2xl font-black border-2 rounded-2xl outline-none transition-all shadow-sm ${
                        digit 
                          ? 'border-blue-500 bg-blue-50/50 text-blue-600' 
                          : 'border-slate-200 bg-slate-50/50 text-slate-400 focus:border-blue-400'
                      }`}
                      disabled={isLoading}
                    />
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 text-red-500 text-xs font-bold py-3 px-4 rounded-xl border border-red-100 text-center">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    variant="ghost"
                    className="w-full h-12 text-sm font-bold text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    onClick={handleResend}
                    disabled={isLoading}
                  >
                    코드를 못 받으셨나요? <span className="underline ml-1">재발송하기</span>
                  </Button>
                  <button
                    onClick={() => { setStep("email"); setCode(["", "", "", "", "", ""]); setError("") }}
                    className="text-xs font-bold text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    이메일 주소 변경
                  </button>
                </div>
              </div>
            )}

            <p className="text-center text-[11px] leading-relaxed text-slate-400 font-medium pt-2">
              가입하시면 이용약관 및 개인정보처리방침에<br />
              동의하게 됩니다.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
