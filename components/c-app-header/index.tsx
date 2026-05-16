"use client"

import type React from "react"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, FileText, TrendingUp, User, Shield } from "lucide-react"
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
  const { user, isLoggedIn, balance: credits, isLoading } = useHub()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)

  // 관리자 권한 확인 (User 객체가 바뀌면 수행)
  useEffect(() => {
    if (user?.email) {
      const localPart = (user.email.split("@")[0] || "").trim().toLowerCase()
      setIsAdmin(localPart === "chiu3")
    } else {
      setIsAdmin(false)
    }
  }, [user])

  // 알림 개수만 별도로 관리 (알림은 Hub SDK가 아직 전담하지 않음)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isLoggedIn) {
      setUnreadCount(0)
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

    fetchUnreadCount()
    const interval = window.setInterval(fetchUnreadCount, 30000)
    return () => window.clearInterval(interval)
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

          {/* 코인 잔액 — 다른 메뉴와 동일한 톤(상단 잔액, 하단 라벨) */}
          {isLoggedIn && (
            <Link
              href="/payment/purchase"
              className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline"
            >
              <div className="px-2.5 h-9 min-w-[40px] rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors flex items-center justify-center">
                <span className="text-sm font-black tabular-nums">
                  {credits !== null ? `${credits.toLocaleString()} C` : '…'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-600">코인</span>
            </Link>
          )}

          {/* REFACTORED_BY_MERLIN_HUB: 표준 프로필 위젯 적용 */}
          <HubProfileWidget 
            onLoginClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
            onProfileClick={() => router.push('/p-my-page?tab=analysis')}
          />

          {isAdmin && isLoggedIn && (
            <div className="hidden lg:flex">
              <MenuItem icon={Shield} label="Admin" href="/p-admin" active={isActive("/p-admin")} />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default AppHeader
