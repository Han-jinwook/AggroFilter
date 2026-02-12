'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import AppHeader from '@/components/c-app-header'
import { TierRoadmap } from './c-tier-roadmap'
import { User, Mail, Camera, Edit2, Save, X, LogOut } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [nickname, setNickname] = useState('chiu3')
  const [profileImage, setProfileImage] = useState('')
  const [tempNickname, setTempNickname] = useState('')
  const [tempProfileImage, setTempProfileImage] = useState('')
  const [predictionStats, setPredictionStats] = useState<{ currentTier: string; avgGap: number; totalPredictions: number }>({ currentTier: 'B', avgGap: 0, totalPredictions: 0 })

  useEffect(() => {
    const savedNickname = localStorage.getItem('userNickname')
    const savedProfileImage = localStorage.getItem('userProfileImage')
    if (savedNickname) setNickname(savedNickname)
    if (savedProfileImage) setProfileImage(savedProfileImage)

    // Fetch user prediction stats
    const email = localStorage.getItem('userEmail')
    if (email) {
      fetch(`/api/prediction/stats?email=${encodeURIComponent(email)}`)
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
  }, [])

  const handleEdit = () => {
    setTempNickname(nickname)
    setTempProfileImage(profileImage)
    setIsEditing(true)
  }

  const handleSave = () => {
    if (tempNickname.trim()) {
      setNickname(tempNickname)
      setProfileImage(tempProfileImage)
      localStorage.setItem('userNickname', tempNickname)
      localStorage.setItem('userProfileImage', tempProfileImage)
      window.dispatchEvent(new Event('profileUpdated'))
      setIsEditing(false)
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
              <input
                type="email"
                value="chiu3@naver.com"
                disabled
                className="w-full px-4 py-2 border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
              />
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

            <div className="bg-card border border-red-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-3">계정</h2>
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
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
