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
import { getUserId, getOrCreateAnonId, isAnonymousUser } from "@/lib/anon"
import { mergeAnonToEmail } from "@/lib/merge"

export default function MainPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [autoStarted, setAutoStarted] = useState(false)

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

  // 매직링크 콜백 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const magicLogin = params.get('magic_login')
    const magicEmail = params.get('email')
    const magicUserId = params.get('userId')
    const loginError = params.get('login_error')

    if (magicLogin === 'success' && magicEmail && magicUserId) {
      localStorage.setItem('userEmail', magicEmail)
      localStorage.setItem('userId', magicUserId)
      const nickname = magicEmail.split('@')[0]
      if (!localStorage.getItem('userNickname')) localStorage.setItem('userNickname', nickname)
      setUserEmail(magicEmail)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (loginError) {
      const msg = loginError === 'expired_token' ? '링크가 만료되었습니다. 다시 로그인해주세요.' : '유효하지 않은 링크입니다.'
      alert(msg)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // 크롬 확장팩에서 진입 시 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get('from')
    const urlParam = params.get('url')

    if (!urlParam || autoStarted || isAnalyzing || isCompleted) return

    setUrl(urlParam)
    setAutoStarted(true)

    // 분석 시작 후 URL 파라미터 제거 → 리마운트/새로고침 시 중복 트리거 방지
    window.history.replaceState({}, '', window.location.pathname)

    if (from === 'chrome-extension') {
      // 확장팩에서 자막 데이터 가져오기 (externally_connectable)
      fetchTranscriptFromExtension().then((extData) => {
        startAnalysis(urlParam, extData?.transcript, extData?.transcriptItems)
      })
    } else {
      startAnalysis(urlParam)
    }
  }, [autoStarted, isAnalyzing, isCompleted])

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

  // 크롬 확장팩에서 자막 데이터 가져오기 (postMessage 리스닝)
  const fetchTranscriptFromExtension = (): Promise<{ transcript?: string; transcriptItems?: any[] } | null> => {
    return new Promise((resolve) => {
      let resolved = false

      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'AGGRO_TRANSCRIPT_DATA' && !resolved) {
          resolved = true
          window.removeEventListener('message', handler)
          // 수신 확인 → inject-transcript.js가 반복 전송 중단
          window.postMessage({ type: 'AGGRO_TRANSCRIPT_RECEIVED' }, '*')
          const data = event.data.data
          if (data?.transcript) {
            console.log(`[확장팩] 자막 데이터 수신: ${data.transcript.length}자`)
            resolve(data)
          } else {
            console.log('[확장팩] 자막 데이터 없음 — 서버 자막 추출로 진행')
            resolve(null)
          }
        }
      }

      window.addEventListener('message', handler)

      // 최대 8초 대기 (inject-transcript.js가 background 응답 받는 시간 포함)
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          window.removeEventListener('message', handler)
          console.log('[확장팩] 자막 데이터 대기 타임아웃 — 서버 자막 추출로 진행')
          resolve(null)
        }
      }, 8000)
    })
  }

  const startAnalysis = async (analysisUrl: string, clientTranscript?: string, clientTranscriptItems?: any[]) => {
    setIsAnalyzing(true)
    const quizMinEndTime = Date.now() + 8000 // 촉퀴즈 최소 표시 시간 8초
    console.log("분석 요청:", analysisUrl, clientTranscript ? `(자막 ${clientTranscript.length}자)` : '(서버 자막)')

    try {
      const currentEmail = userEmail || localStorage.getItem('userEmail')
      let analysisUserId: string
      if (currentEmail) {
        // 로그인 유저: UUID 사용
        analysisUserId = localStorage.getItem('userId') || getUserId()
      } else {
        // 익명 유저: anonId 명시적 생성/저장 (merge를 위해 localStorage.anonId 보장)
        analysisUserId = getOrCreateAnonId()
      }
      const body: any = { 
        url: analysisUrl,
        userId: analysisUserId
      }
      if (clientTranscript) {
        body.clientTranscript = clientTranscript
        body.clientTranscriptItems = clientTranscriptItems
      }

      const fetchAnalysis = async () => {
        const response = await fetch('/api/analysis/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('분석 요청에 실패했습니다.');
        return response.json();
      }

      let result;
      try {
        result = await fetchAnalysis();
      } catch (firstError) {
        // 504 등 게이트웨이 타임아웃: 서버는 분석 중일 수 있으므로 결과 폴링
        console.warn('첫 번째 요청 실패, 결과 폴링 시작...', firstError);
        const pollUrl = `/api/analysis/status?url=${encodeURIComponent(analysisUrl)}`;
        let polled = false;
        for (let i = 0; i < 12; i++) {
          await new Promise(r => setTimeout(r, 5000));
          try {
            const statusRes = await fetch(pollUrl);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.status === 'completed' && statusData.analysisId) {
                console.log('폴링으로 결과 확인:', statusData.analysisId);
                result = { analysisId: statusData.analysisId };
                polled = true;
                break;
              }
            }
          } catch (pollErr) {
            console.warn('폴링 실패:', pollErr);
          }
        }
        if (!polled) {
          throw new Error('분석 결과를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.');
        }
      }
      
      // 촉퀴즈 최소 표시 시간 보장: API가 빨리 응답해도 퀴즈 풀 시간 확보
      const remaining = quizMinEndTime - Date.now()
      if (remaining > 0) {
        await new Promise(r => setTimeout(r, remaining))
      }

      // Analysis is saved in DB with user_id, no localStorage needed
      setAnalysisId(result.analysisId);
      setIsCompleted(true);

      // 익명 사용자 분석 횟수 추적 (모달은 결과 페이지에서 표시)
      if (isAnonymousUser()) {
        const count = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10) + 1;
        localStorage.setItem('anonAnalysisCount', String(count));
      }
    } catch (error) {
      console.error('분석 최종 실패:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleAnalyze = async () => {
    if (!url.trim()) return
    await startAnalysis(url);
  }

  const handleLoginSuccess = async (email: string, userId: string) => {
    localStorage.setItem("userEmail", email)
    if (userId) localStorage.setItem("userId", userId)
    setUserEmail(email)

    // 익명 데이터 → 이메일 계정으로 병합
    await mergeAnonToEmail(userId, email)

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
