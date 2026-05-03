"use client"

import type React from "react"

import { useState, useRef } from "react"
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
  const [referralCode, setReferralCode] = useState("")
  const [showReferralInput, setShowReferralInput] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setError("")
    setIsLoading(true)
    try {
      // 심사용 테스트 계정: Hub API 생략
      if (email === 'test@aggrofilter.com') {
        setStep("code")
        setTimeout(() => inputRefs.current[0]?.focus(), 100)
        return
      }

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
      // KCP 심사관용 테스트 계정: Hub API 우회 및 고정 세션 생성
      // SDK의 hubFetch가 'test-session-token'을 감지하면 허브 호출 없이 mock 응답 반환
      if (email === 'test@aggrofilter.com' && fullCode === '111111') {
        const testUserId = '00000000-0000-4000-8000-000000000001'
        localStorage.setItem('merlin_user_id', testUserId)
        localStorage.setItem('userEmail', email)
        localStorage.setItem('userNickname', 'KCP심사관')
        localStorage.setItem('userId', testUserId)
        localStorage.setItem('merlin_session_token', 'test-session-token')

        onLoginSuccess(email, testUserId)
        return
      }

      const result = await verifyOTP(email, fullCode, 'AGGRO_FILTER', referralCode)
      if (!result.success) {
        setError(result.error || '코드가 올바르지 않거나 만료되었습니다.')
        setCode(["", "", "", "", "", ""])
        setTimeout(() => inputRefs.current[0]?.focus(), 50)
        return
      }
      // REFACTORED_BY_MERLIN_HUB: SDK가 merlin_session_token + merlin_user_id 자동 저장
      // 여기서는 UI 표시용 정보만 추가 저장
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
      setReferralCode("")
      setShowReferralInput(false)
      setError("")
    }
    onOpenChange(isOpen)
  }

  useEffect(() => {
    if (open) {
      const pendingCode = localStorage.getItem('pendingReferralCode')
      if (pendingCode) {
        setReferralCode(pendingCode.toUpperCase())
        setShowReferralInput(true)
        localStorage.removeItem('pendingReferralCode')
      }
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-blue-600 dark:text-blue-400">
            Merlin Family
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground">이메일 인증으로 패밀리 코인과 모든 기능을 이용하세요</p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  이메일 주소
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError("") }}
                  required
                  className="h-12"
                />
              </div>

              {!showReferralInput ? (
                <button
                  type="button"
                  onClick={() => setShowReferralInput(true)}
                  className="text-xs text-blue-500 hover:underline"
                >
                  추천인 코드가 있으신가요?
                </button>
              ) : (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label htmlFor="referral" className="text-sm font-medium text-slate-600">
                    추천인 코드 (선택)
                  </label>
                  <Input
                    id="referral"
                    placeholder="친구의 초대코드 입력"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="h-10 bg-slate-50"
                  />
                </div>
              )}

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
              <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading ? "발송 중..." : "인증코드 받기"}
              </Button>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                <span className="font-semibold">KCP 심사관 안내:</span>{' '}
                <code className="font-mono">test@aggrofilter.com</code> 입력 후 인증코드{' '}
                <code className="font-mono font-bold">111111</code>로 로그인하실 수 있습니다.
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <p className="font-semibold">📧 인증코드를 입력해주세요</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-blue-600">{email}</span>로<br />
                  6자리 코드를 발송했습니다. <span className="text-xs text-slate-400">(5분 유효)</span>
                </p>
              </div>
              <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
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
                    className={`w-11 h-14 text-center text-xl font-bold border-2 rounded-lg outline-none transition-colors ${
                      digit ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    } focus:border-blue-500`}
                    disabled={isLoading}
                  />
                ))}
              </div>
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
              {isLoading && <p className="text-sm text-blue-500 text-center">확인 중...</p>}
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                  onClick={handleResend}
                  disabled={isLoading}
                >
                  {isLoading ? "발송 중..." : "코드 재발송"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setStep("email"); setCode(["", "", "", "", "", ""]); setError("") }}
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
