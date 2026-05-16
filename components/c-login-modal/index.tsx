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
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* 상단 부드러운 배경 색상 */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-blue-50/80 to-transparent -z-10" />
        
        <div className="px-10 pt-12 pb-10">
          <DialogHeader className="flex flex-col items-center gap-6 mb-10">
            <div className="relative w-64 h-24 transition-transform hover:scale-105 duration-300">
              <Image
                src="/images/character-logo.png"
                alt="어그로필터"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="space-y-3 text-center">
              <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
                어그로필터 시작하기 🚀
              </DialogTitle>
              <p className="text-[15px] text-slate-500 font-semibold leading-relaxed tracking-tight">
                지금 바로 <span className="text-blue-600 underline decoration-2 underline-offset-4">무료 분석 코인</span>을 받고<br />
                정밀한 유튜브 분석을 경험해보세요.
              </p>
            </div>
          </DialogHeader>

          <div className="space-y-8">
            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label htmlFor="email" className="text-[13px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">
                    이메일 주소
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError("") }}
                    required
                    className="h-16 bg-slate-100/50 border-transparent focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all rounded-3xl text-[17px] font-medium px-6 shadow-inner"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-500 text-sm font-bold py-4 px-6 rounded-2xl border border-red-100 text-center animate-in fade-in slide-in-from-top-1">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-3xl shadow-xl shadow-blue-600/20 active:scale-[0.97] transition-all" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>준비 중...</span>
                    </div>
                  ) : "인증코드 받기"}
                </Button>
              </form>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div className="text-center space-y-3">
                  <p className="text-lg font-black text-slate-800">📧 인증코드를 입력해주세요</p>
                  <p className="text-[15px] text-slate-500 font-semibold leading-relaxed">
                    <span className="text-blue-600 font-black">{email}</span>로<br />
                    6자리 코드를 보내드렸습니다.
                  </p>
                  <div className="inline-block px-4 py-1.5 bg-slate-100 rounded-full">
                    <p className="text-[11px] text-slate-400 font-bold">
                      인증 메일은 <span className="text-slate-500">통합 계정 센터(os.sundreamer.app)</span>에서 발송됩니다.
                    </p>
                  </div>
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
                      className={`w-12 h-16 text-center text-3xl font-black border-2 rounded-2xl outline-none transition-all shadow-sm ${
                        digit 
                          ? 'border-blue-500 bg-blue-50/50 text-blue-600 ring-4 ring-blue-500/10' 
                          : 'border-slate-200 bg-slate-50/50 text-slate-400 focus:border-blue-400 focus:bg-white'
                      }`}
                      disabled={isLoading}
                    />
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 text-red-500 text-sm font-bold py-4 px-6 rounded-2xl border border-red-100 text-center">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <Button
                    variant="ghost"
                    className="w-full h-14 text-[15px] font-black text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                    onClick={handleResend}
                    disabled={isLoading}
                  >
                    코드가 안 왔나요? <span className="underline decoration-2 underline-offset-4 ml-1">재발송</span>
                  </Button>
                  <button
                    onClick={() => { setStep("email"); setCode(["", "", "", "", "", ""]); setError("") }}
                    className="text-sm font-black text-slate-300 hover:text-slate-500 transition-colors tracking-tight"
                  >
                    다른 이메일 주소 사용하기
                  </button>
                </div>
              </div>
            )}

            <div className="text-center pt-4">
              <span className="text-[11px] text-slate-300 font-bold tracking-tight">
                시작 시 <span className="underline decoration-1 underline-offset-2 hover:text-slate-400 cursor-pointer">이용약관 및 정책</span>에 동의하게 됩니다.
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
