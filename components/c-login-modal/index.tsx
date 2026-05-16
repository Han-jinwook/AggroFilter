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
        <div className="px-10 pt-12 pb-10">
          <DialogHeader className="flex flex-col items-center gap-4 mb-8">
            <div className="relative w-64 h-20 transition-transform hover:scale-105 duration-300">
              <Image
                src="/images/character-logo-ko.png"
                alt="어그로필터"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="space-y-1 text-center">
              <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
                어그로필터 시작하기 🚀
              </DialogTitle>
              <p className="text-[14px] text-slate-400 font-bold tracking-tight">
                지금 바로 무료 분석 코인을 받아보세요.
              </p>
            </div>
          </DialogHeader>

          <div className="space-y-8">
            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Input
                    id="email"
                    type="email"
                    placeholder="이메일 주소 입력 (example@email.com)"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError("") }}
                    required
                    className="h-16 bg-slate-100/50 border-transparent focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all rounded-[1.25rem] text-[17px] font-medium px-6 shadow-inner text-center"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-500 text-sm font-bold py-4 px-6 rounded-2xl border border-red-100 text-center animate-in fade-in">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-[1.25rem] shadow-xl shadow-blue-600/20 active:scale-[0.97] transition-all" 
                  disabled={isLoading}
                >
                  {isLoading ? "준비 중..." : "인증코드 받기"}
                </Button>
              </form>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500 text-center">
                <div className="space-y-2">
                  <p className="text-lg font-black text-slate-800 tracking-tight">인증코드를 입력해주세요</p>
                  <p className="text-[14px] text-slate-400 font-bold">
                    <span className="text-blue-600">{email}</span>로 발송했습니다.
                  </p>
                  <div className="inline-block px-3 py-1 bg-slate-50 rounded-lg">
                    <p className="text-[10px] text-slate-400 font-black tracking-tight">
                      통합계정센터 (os.sundreamer.app)
                    </p>
                  </div>
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
                      className={`w-11 h-14 text-center text-2xl font-black border-2 rounded-xl outline-none transition-all ${
                        digit 
                          ? 'border-blue-500 bg-blue-50/50 text-blue-600 ring-2 ring-blue-500/10' 
                          : 'border-slate-100 bg-slate-50/50 text-slate-300 focus:border-blue-400'
                      }`}
                      disabled={isLoading}
                    />
                  ))}
                </div>

                <div className="flex justify-center gap-4 text-[13px] font-black text-slate-300">
                  <button onClick={handleResend} disabled={isLoading} className="hover:text-blue-500 underline decoration-2 underline-offset-4">재발송</button>
                  <button onClick={() => { setStep("email"); setCode(["", "", "", "", "", ""]); setError("") }} className="hover:text-slate-500">이메일 변경</button>
                </div>
              </div>
            )}

            <div className="text-center pt-2">
              <span className="text-[10px] text-slate-200 font-bold tracking-tight">
                시작 시 정책에 동의하게 됩니다.
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
