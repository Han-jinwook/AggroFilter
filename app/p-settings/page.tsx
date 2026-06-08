'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/c-app-header'
import { getUserId } from '@/lib/anon'
import { 
  HubProfileCard, 
  HubNotificationCard, 
  HubLogoutCard,
  HubHistoryList, 
  useHubReferral,
  useHub
} from '@/src/services/merlin-hub-sdk/react'

export default function SettingsPage() {
  const router = useRouter()
  const { isLoggedIn, user, refreshSession, updateNotificationSettings } = useHub()
  const { getReferralHistory } = useHubReferral()
  
  const [referralHistory, setReferralHistory] = useState<any[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // 단일화된 스마트 알림 상태
  const [smartNotification, setSmartNotification] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // 알림 설정 및 초대 실적은 로그인한 사용자에게만 로드
    if (isLoggedIn && user) {
      // 1. SWR 로컬 캐시 즉시 복원
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('merlin_cached_referral_history')
        if (cached) {
          try {
            setReferralHistory(JSON.parse(cached))
          } catch {}
        }
      }

      // 캐시가 존재할 때는 로딩 스피너를 보여주지 않아 UI 즉각 노출
      setIsHistoryLoading(prev => {
        if (typeof window !== 'undefined') {
          return !localStorage.getItem('merlin_cached_referral_history')
        }
        return prev
      })

      // 백그라운드 갱신 조회
      getReferralHistory()
        .then(res => {
          if (res) {
            setReferralHistory(res)
            if (typeof window !== 'undefined') {
              localStorage.setItem('merlin_cached_referral_history', JSON.stringify(res))
            }
          }
        })
        .catch(err => console.error('Failed to load referrals:', err))
        .finally(() => setIsHistoryLoading(false))

      // 2. 단일 스마트 알림 설정 조회 (허브 user 세션에서 꺼내옴)
      const settings = user.notification_settings || {}
      setSmartNotification(settings.smart_notification !== false)
    } else {
      // 로그아웃 상태면 리스트 초기화 및 캐시 파괴
      setReferralHistory([])
      if (typeof window !== 'undefined') {
        localStorage.removeItem('merlin_cached_referral_history')
      }
    }
  }, [isLoggedIn, user, getReferralHistory])

  const handleToggleSmartNotification = async (newValue: boolean) => {
    setSmartNotification(newValue)
    try {
      const success = await updateNotificationSettings({
        email: newValue,
        smart_notification: newValue
      })
      if (success) {
        // 허브 프로필 동기화
        refreshSession()
      } else {
        setSmartNotification(!newValue)
      }
    } catch {
      setSmartNotification(!newValue)
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="container mx-auto px-4 pt-4 pb-8 max-w-[var(--app-max-width)]">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 왼쪽: 초대 실적 (로그인 유저만 노출) */}
          {isLoggedIn && (
            <div className="w-full flex flex-col gap-6">
              <HubHistoryList history={referralHistory} isLoading={isHistoryLoading} />
            </div>
          )}

          {/* 오른쪽: 프로필 정보 및 알림 설정 */}
          <div className={`w-full space-y-6 ${!isLoggedIn ? 'lg:col-span-2 max-w-xl mx-auto' : ''}`}>
            
            {/* 1. 상단: 허브 공통 프로필 카드 */}
            <HubProfileCard />

            {/* 2. 중단: 스마트 알림 카드 */}
            <HubNotificationCard
              title="알림 설정"
              toggleLabel="📧 이메일 알림 수신"
              description="관심 채널의 신뢰도 등급(안전/주의/위험) 변동 시 이메일로 중요 소식을 보내드립니다."
              enabled={smartNotification}
              onChange={handleToggleSmartNotification}
            />

            {/* 3. 하단: 허브 공통 로그아웃 카드 */}
            <HubLogoutCard onLogout={() => router.push('/')} />

          </div>
        </div>
      </main>
    </div>
  )
}
