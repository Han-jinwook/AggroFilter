"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/c-app-header"
import { LoginModal } from "@/components/c-login-modal"
import { HeroSection } from "@/app/c-home/hero-section"
import { AnalysisStatus, AnalysisCharacter } from "@/app/c-home/analysis-status"
import { FeatureCards } from "@/app/c-home/feature-cards"
import { OnboardingGuide } from "@/app/c-home/onboarding-guide"
import { UrlDisplayBox } from "@/components/c-url-display-box"
import { Disclaimer } from "@/app/c-home/disclaimer"

export default function MainPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail")
    if (storedEmail) setUserEmail(storedEmail)

    let isMounted = true
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        const email = String(data?.user?.email || '')
        if (!email) return
        localStorage.setItem('userEmail', email)
        if (isMounted) setUserEmail(email)
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isCompleted && analysisId) {
      const timer = setTimeout(() => {
        router.push(`/p-result?id=${analysisId}`)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isCompleted, analysisId, router])

  useEffect(() => {
    const handleOpenLoginModal = () => {
      setShowLoginModal(true)
    }
    window.addEventListener("openLoginModal", handleOpenLoginModal)
    return () => {
      window.removeEventListener("openLoginModal", handleOpenLoginModal)
    }
  }, [])

  const startAnalysis = async (analysisUrl: string) => {
    setIsAnalyzing(true)
    console.log("분석 요청:", analysisUrl)

    try {
      const response = await fetch('/api/analysis/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            url: analysisUrl,
            userId: userEmail || localStorage.getItem('userEmail') || undefined
        }),
      });

      if (!response.ok) {
        throw new Error('분석 요청에 실패했습니다.');
      }

      const result = await response.json();
      
      // Analysis is saved in DB with user_id, no localStorage needed
      setAnalysisId(result.analysisId);
      setIsCompleted(true);
    } catch (error) {
      console.error(error);
      // TODO: Add error handling for the user
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleAnalyze = async () => {
    if (!url.trim()) return

    if (!userEmail) {
      setShowLoginModal(true)
      return
    }
    
    await startAnalysis(url);
  }

  const handleLoginSuccess = async (email: string) => {
    localStorage.setItem("userEmail", email)
    setUserEmail(email)

    // DB에서 프로필 정보 fetch (source of truth)
    try {
      const res = await fetch(`/api/user/profile?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        if (data?.user) {
          localStorage.setItem("userNickname", data.user.nickname || email.split("@")[0])
          localStorage.setItem("userProfileImage", data.user.image || "")
        } else {
          // DB에 사용자가 없으면 기본값으로 생성
          localStorage.setItem("userNickname", email.split("@")[0])
          localStorage.setItem("userProfileImage", "")
          await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, nickname: email.split("@")[0], profileImage: null })
          })
        }
      }
    } catch (error) {
      localStorage.setItem("userNickname", email.split("@")[0])
      localStorage.setItem("userProfileImage", "")
    }

    window.dispatchEvent(new CustomEvent("profileUpdated"))

    if (url.trim()) {
      startAnalysis(url);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-[var(--app-max-width)] space-y-6 px-4">
          <HeroSection
            url={url}
            isAnalyzing={isAnalyzing}
            isCompleted={isCompleted}
            onUrlChange={setUrl}
            onAnalyze={handleAnalyze}
          />

          {!isAnalyzing ? <AnalysisStatus isAnalyzing={isAnalyzing} isCompleted={isCompleted} /> : null}

          {!isAnalyzing && !isCompleted && (
            <>
              <FeatureCards />
              <OnboardingGuide />
            </>
          )}

          {!isAnalyzing ? <AnalysisCharacter isAnalyzing={isAnalyzing} isCompleted={isCompleted} /> : null}

          <Disclaimer isAnalyzing={isAnalyzing} isCompleted={isCompleted} />
        </div>
      </main>

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} onLoginSuccess={handleLoginSuccess} />
    </div>
  )
}
