"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/c-app-header'
import { HubAuthModal } from '@/src/services/merlin-hub-sdk/react'
import { isAnonymousUser } from '@/lib/anon'
import { Settings, Bell, TrendingUp, Award, AlertTriangle, CheckCheck } from 'lucide-react'

type TNotification = {
  id: number
  type: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  grade_change: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: '등급 변화' },
  ranking_change: { icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', label: '랭킹 변동' },
  top10_change: { icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50', label: '상위 10%' },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  return new Date(dateStr).toLocaleDateString()
}

export default function Page() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<TNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showLoginModal, setShowLoginModal] = useState(false)

  const isAnon = typeof window !== 'undefined' ? isAnonymousUser() : true
  // REFACTORED_BY_MERLIN_HUB: userId(UUID) 키
  const userId = typeof window !== 'undefined' ? localStorage.getItem('merlin_user_id') || '' : ''

  // 익명 사용자가 알림 페이지 접근 시 로그인 모달 표시
  useEffect(() => {
    if (isAnon) setShowLoginModal(true)
  }, [isAnon])

  const fetchNotifications = useCallback(async () => {
    if (!userId) { setIsLoading(false); return }
    try {
      const res = await fetch(`/api/notification/list?userId=${encodeURIComponent(userId)}`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markAsRead = async (ids: number[]) => {
    if (!userId || ids.length === 0) return
    try {
      await fetch('/api/notification/list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ids })
      })
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n))
    } catch (e) { console.error(e) }
  }

  const markAllAsRead = () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length > 0) markAsRead(unreadIds)
  }

  const handleNotificationClick = (n: TNotification) => {
    if (!n.is_read) markAsRead([n.id])
    if (n.link) router.push(n.link)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  // REFACTORED_BY_MERLIN_HUB: SDK가 merlin_user_id 자동 저장
  const handleLoginSuccess = async (loginEmail: string, _userId: string) => {
    localStorage.setItem('userEmail', loginEmail)
    localStorage.setItem('userNickname', loginEmail.split('@')[0])
    window.dispatchEvent(new CustomEvent('profileUpdated'))
    setShowLoginModal(false)
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-6 max-w-[var(--app-max-width)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">알림</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 active:scale-95 transition-all"
              >
                <CheckCheck className="h-3.5 w-3.5" /> 모두 읽음
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/p-settings')}
              className="h-10 w-10 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all"
              aria-label="알림 설정"
            >
              <Settings className="h-5 w-5 text-slate-700" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Bell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-500">아직 알림이 없습니다</p>
            <p className="text-xs text-slate-400 mt-1">관심 등록한 채널에 변화가 생기면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const config = TYPE_CONFIG[n.type] || { icon: Bell, color: 'text-slate-600', bg: 'bg-slate-50', label: '알림' }
              const Icon = config.icon
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md active:scale-[0.99] ${
                    n.is_read
                      ? 'bg-white border-slate-100 opacity-60'
                      : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 h-10 w-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-rose-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900 leading-snug">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      <HubAuthModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
        onSuccess={handleLoginSuccess} 
        appName="어그로필터" 
        appLogoUrl="/images/character-logo-ko.png" 
        subtitleActionText="분석에" 
      />
    </div>
  )
}
