"use client"

import type React from "react"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, FileText, TrendingUp, User, Shield, Coins } from "lucide-react"
import { useState, useEffect } from "react"
import { getAnonEmoji, getAnonNickname } from "@/lib/anon"
import { checkSession, getBalance, getFamilyUid } from "@/src/services/merlin-hub-sdk"

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
  const pathname = usePathname()
  const [nickname, setNickname] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [unreadCount, setUnreadCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [anonEmoji, setAnonEmoji] = useState("")
  const [anonNickname, setAnonNickname] = useState("")
  const [credits, setCredits] = useState<number | null>(null)

  const isLoggedIn = nickname.length > 0

  useEffect(() => {
    const loadProfile = () => {
      const savedNickname = localStorage.getItem("userNickname") || ""
      const savedProfileImage = localStorage.getItem("userProfileImage") || ""
      const email = localStorage.getItem("userEmail") || ""
      setNickname(savedNickname)
      setProfileImage(savedProfileImage)
      const localPart = (email.split("@")[0] || "").trim().toLowerCase()
      setIsAdmin(localPart === "chiu3")
    }

    loadProfile()

    // REFACTORED_BY_MERLIN_HUB: 익명 세션 제거, stub만 유지
    setAnonEmoji(getAnonEmoji())
    setAnonNickname(getAnonNickname())

    const handleProfileUpdate = () => {
      loadProfile()
    }

    window.addEventListener("profileUpdated", handleProfileUpdate)
    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdate)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    // REFACTORED_BY_MERLIN_HUB: 로컬 /api/auth/me → Hub SDK checkSession
    const syncSession = async () => {
      try {
        const session = await checkSession()
        if (!session.valid || !session.email) return

        const email = session.email
        const nicknameFromEmail = (email.split('@')[0] || '').trim()
        const currentNickname = localStorage.getItem('userNickname') || ''

        if (localStorage.getItem('userEmail') !== email) localStorage.setItem('userEmail', email)
        if (!currentNickname) localStorage.setItem('userNickname', nicknameFromEmail)

        if (isMounted) {
          if (!currentNickname) setNickname(nicknameFromEmail)
          const localPart = nicknameFromEmail.toLowerCase()
          setIsAdmin(localPart === 'chiu3')
        }
      } catch {
      }
    }

    syncSession()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isLoggedIn) {
      setUnreadCount(0)
      setCredits(null)
      return
    }

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch('/api/notification/unread-count', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const nextCount = Number(data?.unreadCount)
        if (Number.isFinite(nextCount) && nextCount >= 0) setUnreadCount(nextCount)
      } catch {
        // ignore
      }
    }

    // REFACTORED_BY_MERLIN_HUB: 로컬 /api/user/credits → Hub wallet SDK
    const fetchCredits = async () => {
      try {
        const result = await getBalance()
        if (result.success && typeof result.balance === 'number') setCredits(result.balance)
      } catch {}
    }

    fetchUnreadCount()
    fetchCredits()
    const interval = window.setInterval(fetchUnreadCount, 30000)

    const handleCreditsUpdated = () => fetchCredits()
    window.addEventListener('creditsUpdated', handleCreditsUpdated)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('creditsUpdated', handleCreditsUpdated)
    }
  }, [isLoggedIn])

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
          />

          <MenuItem icon={TrendingUp} label="분석 Plaza" href="/p-plaza" active={isActive("/p-plaza")} />

          <Link
            href="/payment/mock"
            className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline"
          >
            <div className={`p-2 rounded-xl transition-colors ${isActive('/payment/mock') ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary group-hover:bg-primary/20'}`}>
              <Coins className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-primary">이용권 구매</span>
          </Link>

          {/* 알림 종 — 로그인 상태에선 알림 페이지, 익명이면 로그인 모달 */}
          {isLoggedIn ? (
            <Link
              href="/p-notification"
              className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline"
            >
              <div className="relative">
                <div
                  className={
                    "p-2 rounded-xl transition-colors " +
                    (isActive('/p-notification')
                      ? 'bg-slate-900 text-white'
                      : 'group-hover:bg-slate-100 group-active:bg-slate-900 group-active:text-white')
                  }
                >
                  <Bell className="h-5 w-5 transition-transform group-hover:scale-110" />
                </div>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors">
                알림
              </span>
            </Link>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
              className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline bg-transparent border-none"
            >
              <div className="p-2 rounded-xl group-hover:bg-slate-100 transition-colors">
                <Bell className="h-5 w-5 text-slate-400 transition-transform group-hover:scale-110" />
              </div>
              <span className="text-[10px] font-bold text-slate-500">알림</span>
            </button>
          )}

          {/* 크레딧 잔액 — 다른 메뉴와 동일한 톤(상단 잔액, 하단 라벨) */}
          {isLoggedIn && (
            <Link
              href="/payment/mock"
              className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline"
            >
              <div className="px-2.5 h-9 min-w-[40px] rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors flex items-center justify-center">
                <span className="text-sm font-black tabular-nums">
                  {credits !== null ? `${credits} C` : '…'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-600">크레딧</span>
            </Link>
          )}

          {/* 프로필 */}
          {isLoggedIn ? (
            <>
              <Link
                href="/p-settings"
                className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline"
              >
                {profileImage ? (
                  <div className="p-0.5 rounded-xl border-2 border-transparent group-hover:border-slate-200 transition-colors">
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="h-9 w-9 rounded-lg object-cover shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                    <span className="text-sm font-bold w-5 h-5 flex items-center justify-center">
                      {getFirstChar(nickname)}
                    </span>
                  </div>
                )}
                <span className="text-[10px] font-bold text-slate-900">{nickname}</span>
              </Link>

              {isAdmin && (
                <div className="hidden lg:flex">
                  <MenuItem icon={Shield} label="Admin" href="/p-admin" active={isActive("/p-admin")} />
                </div>
              )}
            </>
          ) : (
            <Link
              href="/p-settings"
              className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline"
            >
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                <span className="text-lg w-5 h-5 flex items-center justify-center">{anonEmoji || '🐾'}</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500">{anonNickname || '게스트'}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default AppHeader
