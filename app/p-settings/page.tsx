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
  const { isLoggedIn, user } = useHub()
  const { getReferralHistory } = useHubReferral()
  
  const [referralHistory, setReferralHistory] = useState<any[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  // 단일화된 스마트 알림 상태
  const [smartNotification, setSmartNotification] = useState(true)

  useEffect(() => {
    // 알림 설정 및 초대 실적은 로그인한 사용자에게만 로드
    if (isLoggedIn && user) {
      const uid = getUserId()
      if (!uid) return

      // 1. 초대 실적 목록 조회
      setIsHistoryLoading(true)
      getReferralHistory()
        .then(res => {
          if (res) setReferralHistory(res)
        })
        .catch(err => console.error('Failed to load referrals:', err))
        .finally(() => setIsHistoryLoading(false))

      // 2. 단일 스마트 알림 설정 조회
      fetch(`/api/subscription/notifications?id=${encodeURIComponent(uid)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setSmartNotification(data.f_smart_notification ?? true)
          }
        })
        .catch(() => {})
    } else {
      // 로그아웃 상태면 리스트 초기화
      setReferralHistory([])
    }
  }, [isLoggedIn, user])

  const handleToggleSmartNotification = (newValue: boolean) => {
    const uid = getUserId()
    if (!uid) return

    setSmartNotification(newValue)

    fetch('/api/subscription/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: uid, enabled: newValue })
    }).catch(() => {
      setSmartNotification(!newValue)
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-[var(--app-max-width)]">

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
              toggleLabel="🔔 스마트 알림"
              description="관심 채널의 신뢰도 등급(안전/주의/위험) 변동 시 알려드립니다."
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
