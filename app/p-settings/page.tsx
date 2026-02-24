'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import AppHeader from '@/components/c-app-header'
import { LoginModal } from '@/components/c-login-modal'
import { TierRoadmap } from './c-tier-roadmap'
import { User, Mail, Camera, Edit2, Save, X, LogOut, Bell, LogIn } from 'lucide-react'
import { getAnonEmoji, getAnonNickname, getOrCreateAnonId, isAnonymousUser } from '@/lib/anon'
import { mergeAnonToEmail } from '@/lib/merge'

export default function SettingsPage() {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [nickname, setNickname] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [email, setEmail] = useState('')
  const [isAnon, setIsAnon] = useState(true)
  const [tempNickname, setTempNickname] = useState('')
  const [tempProfileImage, setTempProfileImage] = useState('')
  const [predictionStats, setPredictionStats] = useState<{ currentTier: string; avgGap: number; totalPredictions: number }>({ currentTier: 'B', avgGap: 0, totalPredictions: 0 })
  const [notifySettings, setNotifySettings] = useState({
    f_notify_grade_change: true,
    f_notify_ranking_change: true,
    f_notify_top10_change: true,
  })
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [rankingThreshold, setRankingThreshold] = useState<10 | 20 | 30>(10)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [anonEmoji, setAnonEmoji] = useState('')

  useEffect(() => {
    const handleOpenLoginModal = () => setShowLoginModal(true)
    window.addEventListener('openLoginModal', handleOpenLoginModal)
    return () => window.removeEventListener('openLoginModal', handleOpenLoginModal)
  }, [])

  const handleLoginSuccess = async (loginEmail: string, userId: string) => {
    localStorage.setItem('userEmail', loginEmail)
    if (userId) localStorage.setItem('userId', userId)
    await mergeAnonToEmail(userId, loginEmail)
    localStorage.setItem('userNickname', loginEmail.split('@')[0])
    window.dispatchEvent(new CustomEvent('profileUpdated'))
    setShowLoginModal(false)
    window.location.reload()
  }

  useEffect(() => {
    const storedThreshold = localStorage.getItem('rankingThreshold')
    if (storedThreshold === '20' || storedThreshold === '30') {
      setRankingThreshold(storedThreshold as unknown as 10 | 20 | 30)
    }
  }, [])

  useEffect(() => {
    const storedEmail = localStorage.getItem('userEmail')
    const anon = isAnonymousUser()
    setIsAnon(anon)
    if (anon) setAnonEmoji(getAnonEmoji())

    if (storedEmail && !anon) {
      setEmail(storedEmail)

      const loadUserData = async () => {
        let uid = localStorage.getItem('userId') || ''
        if (!uid) {
          try {
            const meRes = await fetch('/api/auth/me')
            if (meRes.ok) {
              const meData = await meRes.json()
              if (meData?.user?.id) {
                uid = meData.user.id
                localStorage.setItem('userId', uid)
              }
            }
          } catch {}
        }
        if (!uid) return

        // 프로필 fetch
        fetch(`/api/user/profile?id=${encodeURIComponent(uid)}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.user) {
              const dbNickname = data.user.nickname || storedEmail.split('@')[0]
              const dbImage = data.user.image || ''
              setNickname(dbNickname)
              setProfileImage(dbImage)
              localStorage.setItem('userNickname', dbNickname)
              localStorage.setItem('userProfileImage', dbImage)
              window.dispatchEvent(new Event('profileUpdated'))
            }
          })
          .catch(() => {
            const savedNickname = localStorage.getItem('userNickname')
            const savedProfileImage = localStorage.getItem('userProfileImage')
            if (savedNickname) setNickname(savedNickname)
            if (savedProfileImage) setProfileImage(savedProfileImage)
          })

        // 알림 설정 fetch
        fetch(`/api/subscription/notifications?id=${encodeURIComponent(uid)}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) setNotifySettings({
              f_notify_grade_change: data.f_notify_grade_change ?? true,
              f_notify_ranking_change: data.f_notify_ranking_change ?? true,
              f_notify_top10_change: data.f_notify_top10_change ?? true,
            })
          })
          .catch(() => {})

        // 예측 통계 fetch
        fetch(`/api/prediction/stats?id=${encodeURIComponent(uid)}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              setPredictionStats({
                currentTier: data.currentTier || 'B',
                avgGap: data.avgGap || 0,
                totalPredictions: data.totalPredictions || 0,
              })
            }
          })
          .catch(() => {})
      }

      loadUserData()
    } else {
      // 익명 사용자: localStorage에 저장된 커스텀 값 우선, 없으면 기본값
      const savedNickname = localStorage.getItem('userNickname')
      const savedProfileImage = localStorage.getItem('userProfileImage')
      setNickname(savedNickname || getAnonNickname())
      setProfileImage(savedProfileImage || '')
      setEmail('')
    }
  }, [])

  const handleEdit = () => {
    setTempNickname(nickname)
    setTempProfileImage(profileImage)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (tempNickname.trim()) {
      const storedEmail = localStorage.getItem('userEmail')
      
      if (storedEmail && !isAnon) {
        try {
          const uid = localStorage.getItem('userId') || ''
          // DB에 먼저 저장 (source of truth)
          const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: uid,
              nickname: tempNickname,
              profileImage: tempProfileImage || null
            })
          })

          if (response.ok) {
            const data = await response.json()
            const savedNickname = data.user?.nickname || tempNickname
            const savedImage = data.user?.image || ''
            
            // DB 저장 성공 후 localStorage 캐시 업데이트
            setNickname(savedNickname)
            setProfileImage(savedImage)
            localStorage.setItem('userNickname', savedNickname)
            localStorage.setItem('userProfileImage', savedImage)
            window.dispatchEvent(new Event('profileUpdated'))
            setIsEditing(false)
          } else {
            console.error('Failed to update profile in DB')
          }
        } catch (error) {
          console.error('Profile update error:', error)
        }
      } else {
        // 익명 사용자: localStorage에만 저장
        setNickname(tempNickname)
        setProfileImage(tempProfileImage || '')
        localStorage.setItem('userNickname', tempNickname)
        localStorage.setItem('userProfileImage', tempProfileImage || '')
        window.dispatchEvent(new Event('profileUpdated'))
        setIsEditing(false)
      }
    }
  }

  const handleCancel = () => {
    setTempNickname('')
    setTempProfileImage('')
    setIsEditing(false)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result
        if (typeof result === 'string') {
          setTempProfileImage(result)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        localStorage.clear()
        setNickname('')
        setProfileImage('')
        window.dispatchEvent(new Event('profileUpdated'))
        router.push('/')
      })
  }

  const getDisplayNickname = () => {
    return isEditing ? tempNickname : nickname
  }

  const getDisplayImage = () => {
    return isEditing ? tempProfileImage : profileImage
  }

  const getFirstChar = (text: string) => {
    if (!text || text.length === 0) return 'U'
    return text.charAt(0).toUpperCase()
  }

  const handleToggleNotify = async (key: keyof typeof notifySettings) => {
    const uid = localStorage.getItem('userId')
    if (!uid) return

    setTogglingKey(key)
    try {
      const res = await fetch('/api/subscription/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: uid, key, enabled: !notifySettings[key] })
      })
      if (res.ok) {
        setNotifySettings(prev => ({ ...prev, [key]: !prev[key] }))
      }
    } catch (e) {
      console.error('Toggle notification error:', e)
    } finally {
      setTogglingKey(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-[var(--app-max-width)]">
        <h1 className="text-3xl font-bold mb-8">설정</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 등급 로드맵 */}
          <div className="order-2 lg:order-1">
            <TierRoadmap currentTier={predictionStats.currentTier} currentGap={predictionStats.avgGap} totalPredictions={predictionStats.totalPredictions} />
          </div>

          {/* 오른쪽: 프로필 정보 */}
          <div className="order-1 lg:order-2 space-y-6">
            <div className="bg-card border rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl font-semibold">프로필 정보</h2>
            {!isEditing && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Edit2 className="h-4 w-4" />
                수정하기
              </button>
            )}
          </div>

          <div className="space-y-6">
            {/* 프로필 이미지 */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {getDisplayImage() ? (
                  <Image
                    src={getDisplayImage() || "/placeholder.svg"}
                    alt="Profile"
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-full object-cover"
                    unoptimized
                    loader={({ src }) => src}
                  />
                ) : isAnon ? (
                  <div className="h-20 w-20 rounded-full bg-amber-50 flex items-center justify-center">
                    <span className="text-4xl">{anonEmoji}</span>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {getFirstChar(getDisplayNickname())}
                    </span>
                  </div>
                )}
                {isEditing && (
                  <label className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">프로필 사진</p>
                {isEditing && (
                  <p className="text-xs text-muted-foreground mt-1">
                    클릭하여 이미지 변경
                  </p>
                )}
              </div>
            </div>

            {/* 이메일 */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Mail className="h-4 w-4" />
                이메일
              </label>
              {isAnon ? (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
                  className="w-full px-4 py-2 border rounded-lg bg-amber-50 text-amber-700 text-sm text-left hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  이메일을 등록하면 분석 기록을 보존하고 알림을 받을 수 있어요 →
                </button>
              ) : (
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-2 border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
                />
              )}
            </div>

            {/* 닉네임 */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <User className="h-4 w-4" />
                닉네임
              </label>
              <input
                type="text"
                value={isEditing ? tempNickname : nickname}
                onChange={(e) => setTempNickname(e.target.value)}
                disabled={!isEditing}
                className={`w-full px-4 py-2 border rounded-lg ${
                  isEditing
                    ? 'bg-background focus:outline-none focus:ring-2 focus:ring-primary'
                    : 'bg-muted cursor-not-allowed'
                }`}
              />
            </div>

            {/* 편집 모드 버튼들 */}
            {isEditing && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  <Save className="h-4 w-4" />
                  저장
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                  취소
                </button>
              </div>
            )}
          </div>
        </div>

            {/* 알림 설정 */}
            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Bell className="h-5 w-5" />
                알림 설정
              </h2>
              <p className="text-xs text-muted-foreground mb-4">알림은 하루 2회(오전 8시 · 오후 6시) 모아서 발송됩니다.</p>
              <div className="space-y-3">
                {([
                  { key: 'f_notify_grade_change' as const, label: '등급 변화 알림', desc: '구독 채널의 신뢰도 등급(Red / Yellow / Green)이 변경될 때' },
                  { key: 'f_notify_top10_change' as const, label: 'TOP 10% 알림', desc: '구독 채널이 상위 10%에 진입하거나 탈락할 때 (동일 채널 7일 내 재알림 없음)' },
                ] as { key: keyof typeof notifySettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <button
                      onClick={() => handleToggleNotify(key)}
                      disabled={togglingKey === key}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${
                        notifySettings[key] ? 'bg-blue-500' : 'bg-gray-300'
                      } ${togglingKey === key ? 'opacity-50' : ''}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        notifySettings[key] ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                ))}

                {/* 순위 변동 알림 — 임계값 선택 포함 */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">순위 변동 알림</p>
                      <p className="text-xs text-muted-foreground">순위가 <span className="font-semibold text-foreground">{rankingThreshold}%</span> 이상 변동될 때</p>
                    </div>
                    <button
                      onClick={() => handleToggleNotify('f_notify_ranking_change')}
                      disabled={togglingKey === 'f_notify_ranking_change'}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${
                        notifySettings.f_notify_ranking_change ? 'bg-blue-500' : 'bg-gray-300'
                      } ${togglingKey === 'f_notify_ranking_change' ? 'opacity-50' : ''}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        notifySettings.f_notify_ranking_change ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  {notifySettings.f_notify_ranking_change && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-1">변동 기준:</span>
                      {([10, 20, 30] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            setRankingThreshold(v)
                            localStorage.setItem('rankingThreshold', String(v))
                          }}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            rankingThreshold === v
                              ? 'bg-blue-500 text-white'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
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

            <div className={`bg-card border ${isAnon ? 'border-blue-200' : 'border-red-200'} rounded-xl p-6 shadow-sm`}>
              <h2 className="text-lg font-semibold mb-3">계정</h2>
              {isAnon ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    이메일을 등록하면 기기 변경 시에도 데이터를 유지할 수 있어요.
                  </p>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    <LogIn className="h-4 w-4" />
                    이메일 등록하기
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    로그아웃하면 메인 페이지로 이동합니다.
                  </p>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                  >
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} onLoginSuccess={handleLoginSuccess} />
    </div>
  )
}
