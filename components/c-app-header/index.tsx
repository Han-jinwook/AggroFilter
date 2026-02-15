"use client"

import type React from "react"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, FileText, TrendingUp, User, Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { getAnonEmoji, getAnonNickname, getOrCreateAnonId } from "@/lib/anon"

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

    // 익명 세션 초기화
    getOrCreateAnonId()
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

    const syncSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const email = String(data?.user?.email || '')
        if (!email) return

        const nicknameFromEmail = (email.split('@')[0] || '').trim()
        const currentNickname = localStorage.getItem('userNickname') || ''
        const currentEmail = localStorage.getItem('userEmail') || ''

        if (currentEmail !== email) localStorage.setItem('userEmail', email)
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
    <header className="relative border-b border-slate-200 bg-white/80 backdrop-blur-xl h-20 flex items-center">
      <div className="mx-auto flex w-full max-w-[var(--app-max-width)] items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1 cursor-pointer group no-underline">
          <Image
            src="/images/character-logo.png"
            alt="AggroFilter"
            width={160}
            height={80}
            className="h-14 w-auto object-contain transition-transform group-hover:scale-105"
            priority
          />
          <div className="flex flex-col items-center justify-center h-14 text-slate-500 font-bold text-[10px] leading-tight tracking-wider opacity-80">
            <span className="font-bold text-slate-600">유</span>
            <span className="font-bold text-slate-600">튜</span>
            <span className="font-bold text-slate-600">브</span>
          </div>
        </Link>

        <div className="flex items-center gap-1 sm:gap-4">
          <MenuItem
            icon={FileText}
            label="My Page"
            href={isLoggedIn ? "/p-my-page?tab=analysis" : undefined}
            onClick={isLoggedIn ? undefined : handleMyPageClick}
            active={isActive("/p-my-page")}
          />

          <MenuItem icon={TrendingUp} label="분석 Plaza" href="/p-plaza" active={isActive("/p-plaza")} />

          {isLoggedIn ? (
            <>
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

              <Link
                href="/p-settings"
                className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline"
              >
                {profileImage ? (
                  <div className="p-0.5 rounded-xl border-2 border-transparent group-hover:border-slate-200 transition-colors">
                    <Image
                      src={profileImage || "/placeholder.svg"}
                      alt="Profile"
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-lg object-cover shadow-sm"
                      unoptimized
                      loader={({ src }) => src}
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
            <>
              <Link
                href="/p-settings"
                className="flex flex-col items-center gap-1 transition-colors group px-2 active:scale-95 cursor-pointer no-underline"
                onClick={handleLoginClick}
              >
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                  <span className="text-lg w-5 h-5 flex items-center justify-center">{anonEmoji || '🐾'}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500">{anonNickname || '게스트'}</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default AppHeader
