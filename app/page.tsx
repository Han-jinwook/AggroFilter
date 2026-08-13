"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/c-app-header"
import { HubRegisterNudge, useHub } from "@/src/services/merlin-hub-sdk/react"
import { HeroSection } from "@/app/c-home/hero-section"
import { AnalysisStatus, AnalysisCharacter } from "@/app/c-home/analysis-status"
import { FeatureCards } from "@/app/c-home/feature-cards"
import { OnboardingGuide } from "@/app/c-home/onboarding-guide"
import { Disclaimer } from "@/app/c-home/disclaimer"
// [근본 수정] getUserId, isAnonymousUser 제거 — Hub 세션(isLoggedIn, user.id) 기준으로 전환
import { checkSession } from "@/src/services/merlin-hub-sdk"

export default function MainPage() {
  const router = useRouter()
  const { user, isLoggedIn, isLoading, refreshSession } = useHub()
  const userEmail = user?.email || null
  
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [autoStarted, setAutoStarted] = useState(false)

  // 신규 모바일 브릿지 관련 상태
  const [searchUrl, setSearchUrl] = useState("")
  const [channelData, setChannelData] = useState<any>(null)
  const [showChannelCard, setShowChannelCard] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isQueueRegistering, setIsQueueRegistering] = useState(false)

  // 텍스트에서 URL만 파싱하는 헬퍼
  const extractUrlFromString = (text: string): string | null => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  // [대기제로 1단계] 확장팩 진입 시 홈 UI(찌꺼기) 즉시 숨김
  const [isExtensionEntry] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.get('from') === 'chrome-extension' && !!params.get('url')
  })

  // 토스트 팝업 헬퍼
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  useEffect(() => {
    // 추천인 코드(ref) 캡처 및 PWA 공유 파라미터 캡처
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      localStorage.setItem('pendingReferralCode', ref)
      console.log('Referral code captured from URL:', ref)
      window.dispatchEvent(new CustomEvent('openLoginModal'))
    }

    // PWA 공유(share_target) 파라미터 수신 처리
    const shareText = params.get('text')
    const shareUrl = params.get('url')
    let resolvedUrl = shareUrl || ""

    if (!resolvedUrl && shareText) {
      resolvedUrl = extractUrlFromString(shareText) || ""
    }

    if (resolvedUrl) {
      setSearchUrl(resolvedUrl)
      // 쿼리 매개변수 제거하여 주소창 청소
      window.history.replaceState({}, '', window.location.pathname)
      // 즉시 조회 로직 자동 실행
      setTimeout(() => {
        handleSearch(resolvedUrl)
      }, 500)
    }
  }, [])

  // REFACTORED_BY_MERLIN_HUB: 매직링크 deprecated — Hub OTP 인증으로 전환됨

  const startAnalysis = useCallback(async (analysisUrl: string, clientTranscript?: string, clientTranscriptItems?: any[]) => {
    // [근본 수정] Hub 세션 로딩 중이면 분석 차단 (레이스 컨디션 방지)
    if (isLoading) {
      console.log('[Analysis] Hub 세션 로딩 중 — 분석 대기')
      return
    }

    setIsAnalyzing(true)
    console.log("분석 요청:", analysisUrl, clientTranscript ? `(자막 ${clientTranscript.length}자)` : '(서버 자막)')

    try {
      // [근본 수정] Hub 세션(isLoggedIn)을 유일한 진실 공급원으로 사용
      // localStorage 잔재물(userEmail, merlin_session_token)에 의존하면
      // 세션 만료 기존회원이 코인 차감 없이 무료 분석하는 구멍이 발생함
      let analysisUserId: string
      if (isLoggedIn && user?.id) {
        analysisUserId = user.id
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

      const pollForReadyResult = async (targetUrl: string, maxAttempts = 20, intervalMs = 1500) => {
        const pollUrl = `/api/analysis/status?url=${encodeURIComponent(targetUrl)}`
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((r) => setTimeout(r, intervalMs))
          try {
            const statusRes = await fetch(pollUrl, { cache: 'no-store' })
            if (!statusRes.ok) continue
            const statusData = await statusRes.json()
            if (
              (statusData.status === 'pending' || statusData.status === 'speed_ready' || statusData.status === 'completed') &&
              statusData.analysisId
            ) {
              return { analysisId: statusData.analysisId }
            }
          } catch (pollErr) {
            console.warn('폴링 실패:', pollErr)
          }
        }
        return null
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
        const requestPromise = fetchAnalysis()
        const raced = await Promise.race([
          requestPromise.then((data) => ({ source: 'request' as const, data })),
          pollForReadyResult(analysisUrl).then((data) => (data ? { source: 'poll' as const, data } : null)),
        ])

        if (raced && raced.source === 'poll') {
          result = raced.data
          void requestPromise.catch((err) => {
            console.warn('백그라운드 요청 종료 에러(무시 가능):', err)
          })
        } else if (raced && raced.source === 'request') {
          result = raced.data
        } else {
          result = await requestPromise
        }
      } catch (firstError) {
        const statusCode = Number((firstError as any)?.statusCode)
        const errorData = (firstError as any)?.data

        // [코인 부족] 충전 페이지로 리다이렉트 (충전 후 자동 복귀)
        if (statusCode === 402 && errorData?.insufficientCredits === true) {
          alert('보유하신 코인이 부족합니다. 충전 페이지로 이동합니다.')
          const returnUrl = encodeURIComponent(window.location.pathname)
          router.push(`/payment/purchase?redirectUrl=${returnUrl}`)
          return
        }

        // [cached notAnalyzable]
        if (statusCode === 422 && errorData?.cached === true) {
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
              if ((statusData.status === 'pending' || statusData.status === 'completed' || statusData.status === 'speed_ready') && statusData.analysisId) {
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
      
      // 크레딧 차감 후 헤더 + 광고 컴포넌트 갱신
      window.dispatchEvent(new CustomEvent('creditsUpdated'));

      // 과금 성공 시 5분 광고 제거 타임패스 저장
      if (result?.adFreeUntil) {
        localStorage.setItem('ad_free_until', result.adFreeUntil);
        console.log(`[AdFree] 타임패스 저장: ${result.adFreeUntil}`);
      }

      const readyAnalysisId = result.analysisId;

      // [근본 수정] Hub 세션 기반으로 익명 여부 판단 (localStorage 잔재물 의존 금지)
      if (!isLoggedIn) {
        const count = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10) + 1;
        localStorage.setItem('anonAnalysisCount', String(count));
        
        // 가불 금액 저장!
        if (result?.price) {
          localStorage.setItem('pending_usage_fee', String(result.price));
          localStorage.setItem('pending_video_id', String(result.videoId || result.analysisId || readyAnalysisId));
          console.log(`[Guest Pre-charge] Saved pending_usage_fee: ${result.price}C`);
        }
      }


      // Analysis is saved in DB with user_id, no localStorage needed
      setAnalysisId(readyAnalysisId);
      router.replace(`/p-result?id=${readyAnalysisId}`);
      return;
    } catch (error) {
      console.error('분석 최종 실패:', error);
      const msg = (error as any)?.message
      if (msg) alert(String(msg))
    } finally {
      setIsAnalyzing(false);
    }
  }, [router, isLoggedIn, isLoading, user])

  // 모바일 브릿지 검색 처리 함수
  const handleSearch = async (targetUrlStr: string) => {
    const trimmed = targetUrlStr.trim()
    if (!trimmed) return

    setIsQueueRegistering(true)
    setShowChannelCard(false)
    setChannelData(null)

    try {
      // 1. 이미 분석 완료된 영상인지 즉시 검증 (캐시 히트)
      const statusRes = await fetch(`/api/analysis/status?url=${encodeURIComponent(trimmed)}`, { cache: 'no-store' })
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        if (
          (statusData.status === 'pending' || statusData.status === 'speed_ready' || statusData.status === 'completed') &&
          statusData.analysisId
        ) {
          console.log('[Cache Hit] 기 분석 완료 영상 발견 — 결과 리다이렉트:', statusData.analysisId)
          router.push(`/p-result?id=${statusData.analysisId}`)
          return
        }
      }

      // 2. 캐시 미스 -> 무쿼터 채널 정보 추출 API 호출
      const extractRes = await fetch('/api/channel/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed })
      })

      if (!extractRes.ok) {
        const errData = await extractRes.json()
        throw new Error(errData.error || '채널 정보를 긁어오지 못했습니다.')
      }

      const channelInfo = await extractRes.json()
      const { channelId, channelName } = channelInfo

      // 채널 전적 조회
      const statsRes = await fetch(`/api/channel/${channelId}`)
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setChannelData(statsData)
      } else {
        // 기록이 없는 채널인 경우 기본 템플릿
        setChannelData({
          id: channelId,
          name: channelName,
          totalAnalysis: 0,
          trustScore: 0,
          stats: { accuracy: 0, aggro: 'Low', trend: 'Stable' }
        })
      }
      setShowChannelCard(true)

      // 3. PC 분석 예약 등록 (t_analysis_queue 적재)
      if (isLoggedIn) {
        const queueRes = await fetch('/api/analysis/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed })
        })
        if (queueRes.ok) {
          showToast("✅ 영상이 보관함에 담겼습니다. PC 접속 시 자동 분석됩니다.")
        } else {
          showToast("⚠️ 보관함 저장에 실패했습니다.")
        }
      } else {
        showToast("⚠️ 보관함 예약을 위해 로그인이 필요합니다.")
        // 로그인 모달 열기 트리거
        window.dispatchEvent(new CustomEvent('openLoginModal'))
      }

    } catch (err: any) {
      console.error('[handleSearch Error]:', err)
      alert(err.message || '조회 중 오류가 발생했습니다.')
    } finally {
      setIsQueueRegistering(false)
    }
  }

  // 크롬 확장팩에서 진입 시 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get('from')
    const urlParam = params.get('url')

    if (!urlParam || autoStarted || isAnalyzing || isCompleted) return

    // [대기제로 3단계 호환 안전망] 구버전 확장팩이 / 로 들어온 경우
    // 결과 페이지로 즉시 이관하여 큰 썸네일 + 안내를 먼저 노출.
    if (from === 'chrome-extension') {
      router.replace(`/p-result?url=${encodeURIComponent(urlParam)}&from=chrome-extension`)
      return
    }

    setUrl(urlParam)
    setAutoStarted(true)

    // 분석 시작 후 URL 파라미터 제거 → 리마운트/새로고침 시 중복 트리거 방지
    window.history.replaceState({}, '', window.location.pathname)

    startAnalysis(urlParam)
  }, [autoStarted, isAnalyzing, isCompleted, router, startAnalysis])

  const handleLoginSuccess = async (email: string, userId: string) => {
    localStorage.setItem("userEmail", email)
    if (userId) localStorage.setItem("userId", userId)

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

  const getGradeLabel = (score: number) => {
    if (score >= 90) return { label: 'S급 (최고 신뢰)', color: 'text-green-600 bg-green-50' }
    if (score >= 80) return { label: 'A급 (우수)', color: 'text-blue-600 bg-blue-50' }
    if (score >= 70) return { label: 'B급 (보통)', color: 'text-yellow-600 bg-yellow-50' }
    if (score >= 50) return { label: 'C급 (주의)', color: 'text-orange-600 bg-orange-50' }
    return { label: 'F급 (사기/낚시 가득)', color: 'text-red-600 bg-red-50' }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="flex-1 pt-4 pb-8">
        {isExtensionEntry ? (
          <div className="mx-auto max-w-[var(--app-max-width)] px-4" />
        ) : (
          <div className="mx-auto max-w-[var(--app-max-width)] space-y-6 px-4">
            <HeroSection
              url={url}
              isAnalyzing={isAnalyzing}
              isCompleted={isCompleted}
            />

            {!isAnalyzing ? <AnalysisStatus isAnalyzing={isAnalyzing} isCompleted={isCompleted} /> : null}

            {/* 신규 모바일 브릿지: URL 입력 폼 한가운데 배치 */}
            {!isAnalyzing && !isCompleted && (
              <div className="w-full max-w-xl mx-auto p-4 bg-white rounded-3xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="🔗 유튜브 영상 링크를 붙여넣으세요..."
                    value={searchUrl}
                    onChange={(e) => setSearchUrl(e.target.value)}
                    disabled={isQueueRegistering}
                    className="flex-1 px-4 py-3 rounded-2xl border-3 border-black text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleSearch(searchUrl)}
                    disabled={isQueueRegistering || !searchUrl}
                    className="px-6 py-3 bg-[#FF9800] text-black font-black rounded-2xl border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                  >
                    {isQueueRegistering ? '조회 중...' : '신뢰도 조회'}
                  </button>
                </div>
              </div>
            )}

            {/* 신규 모바일 브릿지: 채널 전적 조회 카드 렌더링 */}
            {showChannelCard && channelData && (
              <div className="w-full max-w-xl mx-auto p-6 bg-white rounded-3xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="flex items-center gap-4">
                  {channelData.profileImage && (
                    <img
                      src={channelData.profileImage}
                      alt={channelData.name}
                      className="w-16 h-16 rounded-full border-3 border-black object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-slate-900 truncate">{channelData.name}</h2>
                    <p className="text-xs font-bold text-slate-500">구독자 {channelData.subscribers || '0'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t-3 border-b-3 border-black py-4 my-2 text-center bg-slate-50 rounded-2xl">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500">총 분석 건수</p>
                    <p className="text-lg font-black text-slate-900">{channelData.totalAnalysis}건</p>
                  </div>
                  <div className="space-y-1 border-l-2 border-r-2 border-black">
                    <p className="text-[10px] font-black text-slate-500">과거 평균 신뢰도</p>
                    {channelData.totalAnalysis > 0 ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black ${getGradeLabel(channelData.trustScore).color}`}>
                        {getGradeLabel(channelData.trustScore).label}
                      </span>
                    ) : (
                      <p className="text-lg font-black text-slate-400">-</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500">어그로 위험도</p>
                    <p className={`text-base font-black ${
                      channelData.stats?.aggro === 'High' ? 'text-red-600' :
                      channelData.stats?.aggro === 'Medium' ? 'text-amber-500' : 'text-green-600'
                    }`}>
                      {channelData.stats?.aggro === 'High' ? '🚨 높음' :
                       channelData.stats?.aggro === 'Medium' ? '⚠️ 보통' : '✅ 낮음'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border-3 border-blue-600 rounded-2xl text-xs font-bold text-blue-800 space-y-1 leading-relaxed">
                  <p className="font-extrabold flex items-center gap-1 text-sm text-blue-900">
                    <span>🖥️ PC 정밀 분석 예약 완료</span>
                  </p>
                  <p>
                    모바일 환경은 유튜브 자막 추출이 제한됩니다. 이 영상은 보관함(Queue)에 담겼으며, PC에서 어그로필터 크롬 확장팩이 설치된 브라우저를 켜시면 백그라운드에서 자동으로 정밀 팩트체크가 완료됩니다!
                  </p>
                </div>
              </div>
            )}

            {!isAnalyzing && !isCompleted && (
              <>
                <FeatureCards />
                <HubRegisterNudge />
                <OnboardingGuide />
              </>
            )}

            {!isAnalyzing ? <AnalysisCharacter isAnalyzing={isAnalyzing} isCompleted={isCompleted} /> : null}

            <Disclaimer isAnalyzing={isAnalyzing} isCompleted={isCompleted} />
          </div>
        )}
      </main>

      {/* 토스트 알림 메시지 팝업 */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-black px-6 py-3 rounded-full border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
