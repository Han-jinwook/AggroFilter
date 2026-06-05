"use client"

import type React from "react"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FileText, TrendingUp, User, Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { getAnonEmoji, getAnonNickname } from "@/lib/anon"
import { useHub, HubProfileWidget } from "@/src/services/merlin-hub-sdk/react"

export function checkLoginStatus(): boolean {
  if (typeof window === "undefined") return false
  const nickname = localStorage.getItem("userNickname")
  return !!(nickname && nickname.length > 0)
}

export function openLoginModal() {
  window.dispatchEvent(new CustomEvent("openLoginModal"))
}

interface TAppHeaderProps {
  onLoginClick?: () => void
}

export function AppHeader({ onLoginClick }: TAppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoggedIn, balance: credits, isLoading } = useHub()
  
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingFee, setPendingFee] = useState<number | null>(null)

  // 비로그인 가불금 실시간 감지
  useEffect(() => {
    const updatePendingFee = () => {
      const stored = localStorage.getItem('pending_usage_fee')
      if (stored) {
        setPendingFee(parseInt(stored, 10))
      } else {
        setPendingFee(null)
      }
    }
    
    updatePendingFee()
    window.addEventListener('creditsUpdated', updatePendingFee)
    window.addEventListener('profileUpdated', updatePendingFee)
    return () => {
      window.removeEventListener('creditsUpdated', updatePendingFee)
      window.removeEventListener('profileUpdated', updatePendingFee)
    }
  }, [])

  // 관리자 권한 확인 (User 객체가 바뀌면 수행)
  useEffect(() => {
    if (user?.email) {
      const localPart = (user.email.split("@")[0] || "").trim().toLowerCase()
      setIsAdmin(localPart === "chiu3")
    } else {
      setIsAdmin(false)
    }
  }, [user])

  const isActive = (path: string) => {
    return pathname.startsWith(path)
  }

  const getFirstChar = (text: string) => {
    if (!text || text.length === 0) return "C"
    return text.charAt(0).toUpperCase()
  }

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isLoggedIn) {
      onLoginClick?.()
    }
  }

  const handleMyPageClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault()
      onLoginClick?.()
    }
  }

  const MenuItem = ({
    icon: Icon,
    label,
    active,
    onClick,
    href,
  }: {
    icon: any
    label: string
    active?: boolean
    onClick?: (e: React.MouseEvent) => void
    href?: string
  }) => {
    const content = (
      <>
        <div
          className={`p-2 rounded-xl transition-colors ${
            active
              ? "bg-slate-900 text-white"
              : "group-hover:bg-slate-100 group-active:bg-slate-900 group-active:text-white"
          }`}
        >
          <Icon className={`h-5 w-5 transition-transform ${active ? "" : "group-hover:scale-110"}`} />
        </div>
        <span
          className={`text-[10px] font-bold transition-colors ${
            active ? "text-slate-900" : "text-slate-500 group-hover:text-slate-900"
          }`}
        >
          {label}
        </span>
      </>
    )

    const className =
      "flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline bg-transparent border-none"

    if (href) {
      return (
        <Link href={href} className={className} onClick={onClick}>
          {content}
        </Link>
      )
    }

    return (
      <button onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl h-20 flex items-center py-0">
        <div className="mx-auto flex w-full max-w-[var(--app-max-width)] items-center justify-between px-4 py-0">
          <Link href="/" className="flex items-center gap-1.5 cursor-pointer group no-underline py-0">
            <Image
              src="/images/character-logo.png"
              alt="AggroFilter"
              width={240}
              height={120}
              className="h-[4.75rem] w-auto object-contain transition-transform group-hover:scale-105"
              priority
            />
            <div className="flex flex-col items-center justify-center h-[4.75rem] text-slate-500 font-bold text-base leading-tight tracking-wider opacity-80">
              <span className="font-bold text-slate-600">유</span>
              <span className="font-bold text-slate-600">튜</span>
              <span className="font-bold text-slate-600">브</span>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-4">
            <MenuItem
              icon={FileText}
              label="My Page"
              href="/p-my-page?tab=analysis"
              active={isActive("/p-my-page")}
              onClick={handleMyPageClick}
            />

            <MenuItem icon={TrendingUp} label="분석 Plaza" href="/p-plaza" active={isActive("/p-plaza")} />


            {/* 코인 잔액 — 로그인 상태거나 비로그인 가불 잔액이 있는 경우 */}
            {(isLoggedIn || pendingFee !== null) && (
              <Link
                href={isLoggedIn ? "/payment/purchase" : "#"}
                onClick={(e) => {
                  if (!isLoggedIn) {
                    e.preventDefault()
                    window.dispatchEvent(new CustomEvent('openLoginModal'))
                  }
                }}
                className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline"
              >
                <div className={`px-2.5 h-9 min-w-[40px] rounded-xl transition-colors flex items-center justify-center ${
                  !isLoggedIn && pendingFee !== null 
                    ? "bg-red-50 text-red-600 group-hover:bg-red-100 animate-bounce" 
                    : "bg-amber-50 text-amber-600 group-hover:bg-amber-100"
                }`}>
                  <span className="text-sm font-black tabular-nums">
                    {isLoggedIn 
                      ? (credits !== null ? `${credits.toLocaleString()} C` : '…')
                      : `-${pendingFee} C`
                    }
                  </span>
                </div>
                <span className={`text-[10px] font-bold ${
                  !isLoggedIn && pendingFee !== null ? "text-red-600 font-black" : "text-amber-600"
                }`}>코인</span>
              </Link>
            )}

            {/* REFACTORED_BY_MERLIN_HUB: 표준 프로필 위젯 적용 (클릭 시 페이지 이동) */}
            <HubProfileWidget 
              onLoginClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
              onProfileClick={() => router.push('/p-settings')}
            />

            {isAdmin && isLoggedIn && (
              <div className="hidden lg:flex">
                <MenuItem icon={Shield} label="Admin" href="/p-admin" active={isActive("/p-admin")} />
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}

export default AppHeader
