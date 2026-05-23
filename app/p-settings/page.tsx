'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import AppHeader from '@/components/c-app-header'
import { Bell } from 'lucide-react'
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

  // 어그로필터 전용 알림 상태
  const [notifySettings, setNotifySettings] = useState({
    f_notify_grade_change: true,
    f_notify_ranking_change: true,
    f_notify_top10_change: true,
  })
  const [rankingThreshold, setRankingThreshold] = useState<10 | 20 | 30>(10)

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

      // 2. 어그로필터 전용 알림 설정 fetch
      fetch(`/api/subscription/notifications?id=${encodeURIComponent(uid)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setNotifySettings({
              f_notify_grade_change: data.f_notify_grade_change ?? true,
              f_notify_ranking_change: data.f_notify_ranking_change ?? true,
              f_notify_top10_change: data.f_notify_top10_change ?? true,
            })
            const t = Number(data.f_ranking_threshold)
            if (t === 10 || t === 20 || t === 30) setRankingThreshold(t)
          }
        })
        .catch(() => {})
    } else {
      // 로그아웃 상태면 리스트 초기화
      setReferralHistory([])
    }
  }, [isLoggedIn, user])

  const handleThresholdChange = async (v: 10 | 20 | 30) => {
    const uid = getUserId()
    if (!uid) return
    setRankingThreshold(v)
    try {
      await fetch('/api/subscription/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: uid, rankingThreshold: v })
      })
    } catch (e) {
      console.error('Threshold update error:', e)
    }
  }

  const handleToggleNotify = (key: keyof typeof notifySettings) => {
    const uid = getUserId()
    if (!uid) return

    const newValue = !notifySettings[key]
    setNotifySettings(prev => ({ ...prev, [key]: newValue }))

    fetch('/api/subscription/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: uid, key, enabled: newValue })
    }).catch(() => {
      setNotifySettings(prev => ({ ...prev, [key]: !newValue }))
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-4xl">

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

            {/* 2. 중단: 허브 공통 알림 카드 + 어그로필터 전용 알림(children) */}
            <HubNotificationCard>
              <div className="mt-4">
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full">AggroFilter</span>
                  어그로필터 전용 알림
                </h3>
                <p className="text-xs text-slate-500 mb-4">알림은 하루 2회(오전 12시 · 오후 7시) 모아서 발송됩니다.</p>
                
                <div className="space-y-3">
                  {([
                    { key: 'f_notify_grade_change' as const, label: '등급 변화 알림', desc: '구독 채널의 신뢰도 등급(Red / Yellow / Green)이 변경될 때' },
                    { key: 'f_notify_top10_change' as const, label: 'TOP 10% 알림', desc: '구독 채널이 상위 10%에 진입하거나 탈락할 때 (동일 채널 7일 내 재알림 없음)' },
                  ] as { key: keyof typeof notifySettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="min-w-0 pr-4">
                        <p className="text-sm font-bold text-slate-800">{label}</p>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">{desc}</p>
                      </div>
                      <button
                        onClick={() => handleToggleNotify(key)}
                        disabled={!isLoggedIn}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                          !isLoggedIn ? 'bg-slate-200 cursor-not-allowed opacity-50' :
                          notifySettings[key] ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notifySettings[key] ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}

                  {/* 순위 변동 알림 — 임계값 선택 포함 */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 pr-4">
                        <p className="text-sm font-bold text-slate-800">순위 변동 알림</p>
                        <p className="text-[11px] text-slate-500 mt-1">순위가 <span className="font-bold text-slate-700">{rankingThreshold}%</span> 이상 변동될 때</p>
                      </div>
                      <button
                        onClick={() => handleToggleNotify('f_notify_ranking_change')}
                        disabled={!isLoggedIn}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                          !isLoggedIn ? 'bg-slate-200 cursor-not-allowed opacity-50' :
                          notifySettings.f_notify_ranking_change ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notifySettings.f_notify_ranking_change ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    {notifySettings.f_notify_ranking_change && isLoggedIn && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 mr-1">변동 기준:</span>
                        {([10, 20, 30] as const).map((v) => (
                          <button
                            key={v}
                            onClick={() => handleThresholdChange(v)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                              rankingThreshold === v
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {v}%
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </HubNotificationCard>

            {/* 3. 하단: 허브 공통 로그아웃 카드 */}
            <HubLogoutCard onLogout={() => router.push('/')} />

          </div>
        </div>
      </main>
    </div>
  )
}
