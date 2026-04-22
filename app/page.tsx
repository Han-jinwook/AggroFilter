"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/c-app-header"
import { LoginModal } from "@/components/c-login-modal"
import { HeroSection } from "@/app/c-home/hero-section"
import { AnalysisStatus, AnalysisCharacter } from "@/app/c-home/analysis-status"
import { FeatureCards } from "@/app/c-home/feature-cards"
import { OnboardingGuide } from "@/app/c-home/onboarding-guide"
import { Disclaimer } from "@/app/c-home/disclaimer"
import { getUserId, isAnonymousUser } from "@/lib/anon"
import { checkSession } from "@/src/services/merlin-hub-sdk"

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

    // REFACTORED_BY_MERLIN_HUB: 로컬 /api/auth/me → Hub SDK checkSession
    let isMounted = true
    checkSession().then((session) => {
      if (!session.valid || !session.email) return
      localStorage.setItem('userEmail', session.email)
      if (isMounted) setUserEmail(session.email)
    }).catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  // REFACTORED_BY_MERLIN_HUB: 매직링크 deprecated — Hub OTP 인증으로 전환됨

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
    const quizStartTime = Date.now()
    const quizMinEndTime = quizStartTime + 8000 // 촉퀴즈 최소 표시 시간 8초
    console.log("분석 요청:", analysisUrl, clientTranscript ? `(자막 ${clientTranscript.length}자)` : '(서버 자막)')

    try {
      const currentEmail = userEmail || localStorage.getItem('userEmail')
      let analysisUserId: string
      if (currentEmail) {
        // REFACTORED_BY_MERLIN_HUB: 로그인 유저 — Hub family_uid 사용
        analysisUserId = getUserId()
      } else {
        // 비로그인: 1회 무료 체험 (휘발성, DB 미보관)
        const trialCount = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10)
        if (trialCount >= 1) {
          setIsAnalyzing(false)
          window.dispatchEvent(new CustomEvent('openLoginModal'))
          return
        }
        // 휘발성 1회용 ID (localStorage에 저장하지 않음)
        analysisUserId = 'trial_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8)
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
        if (!response.ok) {
          let errorMessage = '분석 요청에 실패했습니다.'
          let errorData: any = null
          try {
            const data = await response.json()
            errorData = data
            if (data?.error) errorMessage = String(data.error)
          } catch {
          }

          const err: any = new Error(errorMessage)
          err.statusCode = response.status
          err.data = errorData
          throw err
        }
        return response.json();
      }

      let result;
      try {
        result = await fetchAnalysis();
      } catch (firstError) {
        const statusCode = Number((firstError as any)?.statusCode)
        const errorData = (firstError as any)?.data

        // [크레딧 부족] 충전 페이지로 리다이렉트 (충전 후 자동 복귀)
        if (statusCode === 402 && errorData?.insufficientCredits === true) {
          alert('크레딧이 부족합니다. 충전 페이지로 이동합니다.')
          const returnUrl = encodeURIComponent(window.location.pathname)
          router.push(`/payment/mock?redirectUrl=${returnUrl}`)
          return
        }

        // [cached notAnalyzable] UX 연출: 캐시로 즉시 컷되더라도 촉퀴즈를 10초 정도 유지 후 안내
        if (statusCode === 422 && errorData?.cached === true) {
          const minEndTime = quizStartTime + 10000
          const remaining = minEndTime - Date.now()
          if (remaining > 0) {
            await new Promise((r) => setTimeout(r, remaining))
          }
          const msg = (firstError as any)?.message
          if (msg) alert(String(msg))
          return
        }

        const shouldPoll = statusCode === 504 || statusCode === 502 || statusCode === 503
        if (!shouldPoll) throw firstError

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
      
      // 촉퀴즈 최소 표시 시간 보장: 캐시 히트는 10초 연출, 일반 케이스는 8초
      const minEndTime = result?.cached === true ? (quizStartTime + 10000) : quizMinEndTime
      const remaining = minEndTime - Date.now()
      if (remaining > 0) {
        await new Promise(r => setTimeout(r, remaining))
      }

      // Analysis is saved in DB with user_id, no localStorage needed
      setAnalysisId(result.analysisId);
      setIsCompleted(true);

      // 크레딧 차감 후 헤더 + 광고 컴포넌트 갱신
      window.dispatchEvent(new CustomEvent('creditsUpdated'));

      // 익명 사용자 분석 횟수 추적 (모달은 결과 페이지에서 표시)
      if (isAnonymousUser()) {
        const count = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10) + 1;
        localStorage.setItem('anonAnalysisCount', String(count));
      }
    } catch (error) {
      console.error('분석 최종 실패:', error);
      const msg = (error as any)?.message
      if (msg) alert(String(msg))
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleLoginSuccess = async (email: string, userId: string) => {
    localStorage.setItem("userEmail", email)
    if (userId) localStorage.setItem("userId", userId)
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

    // 가입 보너스 3,000C 지급 시도 (최초 1회만)
    try {
      const bonusRes = await fetch('/api/user/signup-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const bonusData = await bonusRes.json()
      if (bonusData.bonus > 0) {
        alert(`🎉 가입 축하 보너스!\n\n${bonusData.bonus.toLocaleString()} C 가 지급되었습니다.\n(${Math.floor(bonusData.bonus / 30)}회 분석 가능)`)
      }
      window.dispatchEvent(new CustomEvent('creditsUpdated'))
    } catch {}
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
