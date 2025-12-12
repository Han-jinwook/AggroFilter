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
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail")
    if (storedEmail) {
      setUserEmail(storedEmail)
    }
  }, [])

  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        router.push("/p-result")
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isCompleted, router])

  useEffect(() => {
    const handleOpenLoginModal = () => {
      setShowLoginModal(true)
    }
    window.addEventListener("openLoginModal", handleOpenLoginModal)
    return () => {
      window.removeEventListener("openLoginModal", handleOpenLoginModal)
    }
  }, [])

  const handleAnalyze = async () => {
    if (!url.trim()) return

    if (!userEmail) {
      setShowLoginModal(true)
      return
    }

    setIsAnalyzing(true)
    console.log("분석 요청:", url)

    setTimeout(() => {
      setIsAnalyzing(false)
      setIsCompleted(true)
    }, 5000)
  }

  const handleLoginSuccess = (email: string) => {
    localStorage.setItem("userEmail", email)
    setUserEmail(email)

    const nickname = email.split("@")[0]
    localStorage.setItem("userNickname", nickname)
    localStorage.setItem("userProfileImage", "")

    window.dispatchEvent(new CustomEvent("profileUpdated"))

    if (url.trim()) {
      setIsAnalyzing(true)
      console.log("분석 요청:", url)
      setTimeout(() => {
        setIsAnalyzing(false)
        setIsCompleted(true)
      }, 5000)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      <main className="container flex-1 px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <HeroSection
            url={url}
            isAnalyzing={isAnalyzing}
            isCompleted={isCompleted}
            onUrlChange={setUrl}
            onAnalyze={handleAnalyze}
          />

          <AnalysisStatus isAnalyzing={isAnalyzing} isCompleted={isCompleted} />

          {!isAnalyzing && !isCompleted && (
            <>
              <FeatureCards />
              <OnboardingGuide />
            </>
          )}

          <AnalysisCharacter isAnalyzing={isAnalyzing} isCompleted={isCompleted} />

          <Disclaimer isAnalyzing={isAnalyzing} isCompleted={isCompleted} />
        </div>
      </main>

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} onLoginSuccess={handleLoginSuccess} />
    </div>
  )
}
