"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/c-button"
import { AppHeader, checkLoginStatus } from "@/components/c-app-header"
import { AnalysisHeader } from "@/app/p-result/c-result/analysis-header"
import { SubtitleButtons } from "@/app/p-result/c-result/subtitle-buttons"
import { ScoreCard } from "@/app/p-result/c-result/score-card"
import { AnalysisGuide } from "@/app/p-result/c-result/analysis-guide"
import { getCategoryName } from "@/lib/constants"
import { getUserId, isAnonymousUser } from "@/lib/anon"
import { ShareModal } from "@/components/c-share-modal"
import { ChevronDown, ChevronUp, MoreVertical, ChevronLeft, Share2, Play } from "lucide-react"
import { useHub } from "@/src/services/merlin-hub-sdk/react"

function extractVideoId(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v') || url
  } catch {
    return url
  }
}

// [B안] 타자기 효과: 글자 단위로 animation-delay 적용해 순차 reveal
function TypewriterText({ text, perChar = 55, startDelay = 100 }: { text: string; perChar?: number; startDelay?: number }) {
  return (
    <span className="hero-type" aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ animationDelay: `${startDelay + i * perChar}ms` }}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </span>
  )
}

export default function ResultClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoggedIn, isLoading } = useHub()
  const hasCountedView = useRef(false)
  const [showMore, setShowMore] = useState(true)
  const [activeSubtitle, setActiveSubtitle] = useState<"summary" | null>("summary")
  const [youthAge, setYouthAge] = useState("")
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState("")
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null)
  const [userNickname, setUserNickname] = useState<string>("")
  const [isClient, setIsClient] = useState(false)
  const [playerTime, setPlayerTime] = useState(0)
  const [showPlayer, setShowPlayer] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null);

  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRefining, setIsRefining] = useState(false)
  const [showPhase2, setShowPhase2] = useState(false)
  const [showPhase3, setShowPhase3] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // [대기제로 3단계] 확장팩/URL 진입 시 썸네일 히어로
  const [pendingThumb, setPendingThumb] = useState<string | null>(null)
  const pendingStartedRef = useRef(false)
  const phase2TimerRef = useRef<number | null>(null)
  const phase3TimerRef = useRef<number | null>(null)
  const phase2ReadyRef = useRef(false)
  const completedWaitingPhase3Ref = useRef(false)

  useEffect(() => {
    if (isLoading) return;

    if (isLoggedIn && user?.email) {
      const email = user.email;
      // DB에서 프로필 정보 fetch (source of truth)
      fetch(`/api/user/profile?email=${encodeURIComponent(email)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user) {
            const dbNickname = data.user.nickname || email.split('@')[0]
            const dbImage = data.user.image || ''
            setUserNickname(dbNickname)
            setUserProfileImage(dbImage)
            localStorage.setItem('userNickname', dbNickname)
            localStorage.setItem('userProfileImage', dbImage)
          } else {
            setUserNickname(user.nickname || email.split('@')[0])
            setUserProfileImage(user.avatar_url || '')
          }
        })
        .catch(() => {
          setUserNickname(user.nickname || email.split('@')[0])
          setUserProfileImage(user.avatar_url || '')
        })
    } else {
      setUserNickname('게스트')
      setUserProfileImage('🐾')
    }
  }, [isLoading, isLoggedIn, user])

  useEffect(() => {
    setIsRefining(false)
    setShowPhase2(false)
    setShowPhase3(false)
    phase2ReadyRef.current = false
    completedWaitingPhase3Ref.current = false
    if (phase2TimerRef.current !== null) {
      clearTimeout(phase2TimerRef.current)
      phase2TimerRef.current = null
    }
    if (phase3TimerRef.current !== null) {
      clearTimeout(phase3TimerRef.current)
      phase3TimerRef.current = null
    }
    const initialId = searchParams.get("id")
    const urlParam = searchParams.get("url")
    const fromParam = searchParams.get("from")

    // 썸네일 히어로 즉시 표시 (id 없이 url로 진입한 경우)
    if (!initialId && urlParam) {
      const vId = extractVideoId(urlParam)
      if (vId) {
        setPendingThumb(`https://img.youtube.com/vi/${vId}/hqdefault.jpg`)
      }
    }

    if (!initialId && !urlParam) {
      setError("분석 ID가 없습니다.")
      setLoading(false)
      return
    }

    let isCancelled = false;
    let id: string | null = initialId

    // [대기제로 3단계] 확장팩 진입용 pending 플로우
    const runPendingFlow = async (analysisUrl: string, from: string | null): Promise<string> => {
      // 1) 확장팩 자막 수신 (최대 8초)
      let clientTranscript: string | undefined
      let clientTranscriptItems: any[] | undefined
      if (from === 'chrome-extension') {
        const ext = await new Promise<{ transcript?: string; transcriptItems?: any[] } | null>((resolve) => {
          let resolved = false
          const handler = (event: MessageEvent) => {
            if (event.data?.type === 'AGGRO_TRANSCRIPT_DATA' && !resolved) {
              resolved = true
              window.removeEventListener('message', handler)
              window.postMessage({ type: 'AGGRO_TRANSCRIPT_RECEIVED' }, '*')
              const d = event.data.data
              resolve(d?.transcript ? d : null)
            }
          }
          window.addEventListener('message', handler)
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              window.removeEventListener('message', handler)
              resolve(null)
            }
          }, 8000)
        })
        if (ext?.transcript) {
          clientTranscript = ext.transcript
          clientTranscriptItems = ext.transcriptItems
        }
      }

      // 2) 사용자 식별 / 1회 체험 제한
      const currentEmail = user?.email || localStorage.getItem('userEmail')
      let analysisUserId: string | null = null
      if (currentEmail) {
        analysisUserId = getUserId()
      }
      
      if (!analysisUserId) {
        const trialCount = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10)
        if (trialCount >= 1) {
          window.dispatchEvent(new CustomEvent('openLoginModal'))
          throw new Error('로그인이 필요합니다.')
        }
        analysisUserId = 'trial_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8)
      }

      const body: any = { url: analysisUrl, userId: analysisUserId }
      if (clientTranscript) {
        body.clientTranscript = clientTranscript
        body.clientTranscriptItems = clientTranscriptItems
      }

      const pollForId = async (maxAttempts = 20, intervalMs = 1500): Promise<string | null> => {
        const pollUrl = `/api/analysis/status?url=${encodeURIComponent(analysisUrl)}`
        for (let i = 0; i < maxAttempts; i++) {
          if (isCancelled) return null
          await new Promise((r) => setTimeout(r, intervalMs))
          try {
            const r = await fetch(pollUrl, { cache: 'no-store' })
            if (!r.ok) continue
            const d = await r.json()
            if ((d.status === 'pending' || d.status === 'speed_ready' || d.status === 'completed') && d.analysisId) {
              return d.analysisId
            }
          } catch {}
        }
        return null
      }

      const requestPromise = fetch('/api/analysis/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (res) => {
        if (!res.ok) {
          let data: any = null
          try { data = await res.json() } catch {}
          const err: any = new Error(data?.error || '분석 요청에 실패했습니다.')
          err.statusCode = res.status
          err.data = data
          throw err
        }
        return res.json()
      })

      const raced = await Promise.race([
        requestPromise.then((data) => ({ source: 'request' as const, data })),
        pollForId().then((aid) => (aid ? { source: 'poll' as const, data: { analysisId: aid } } : null)),
      ])

      let resolved: any
      if (raced && raced.source === 'poll') {
        resolved = raced.data
        void requestPromise.catch(() => {})
      } else if (raced && raced.source === 'request') {
        resolved = raced.data
      } else {
        resolved = await requestPromise
      }

      if (!resolved?.analysisId) throw new Error('분석 결과를 받지 못했습니다.')

      window.dispatchEvent(new CustomEvent('creditsUpdated'))
      if (isAnonymousUser()) {
        const count = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10) + 1
        localStorage.setItem('anonAnalysisCount', String(count))
        
        // 가불 금액 저장!
        if (resolved?.price) {
          localStorage.setItem('pending_usage_fee', String(resolved.price))
          localStorage.setItem('pending_video_id', String(resolved.videoId || resolved.analysisId))
          console.log(`[Guest Pre-charge] Saved pending_usage_fee: ${resolved.price}C`)
        }
      }

      return resolved.analysisId as string
    }

    const fetchAnalysisData = async () => {
      try {
        setLoading(true)
        const uid = getUserId()
        const liteQuery = `${uid ? `userId=${encodeURIComponent(uid)}&` : ''}lite=1`
        const fullQuery = `${uid ? `?userId=${encodeURIComponent(uid)}` : ''}`

        const response = await fetch(`/api/analysis/result/${id}?${liteQuery}`, {
          cache: 'no-store'
        })
        
        if (!response.ok) {
          throw new Error("분석 결과를 불러오는데 실패했습니다.")
        }
        let data = await response.json()

        const isCompletedPayload = (payload: any) => {
          const stage = payload?.analysisData?.processingStage
          if (stage === 'completed') return true
          if (stage === 'speed_ready') return false
          const scores = payload?.analysisData?.scores
          return (
            typeof scores?.accuracy === 'number' &&
            typeof scores?.clickbait === 'number' &&
            typeof scores?.trust === 'number'
          )
        }

        const hasSpeedPayload = (payload: any) => {
          const stage = payload?.analysisData?.processingStage
          if (stage === 'speed_ready' || stage === 'completed') return true

          const summary = payload?.analysisData?.summarySubtitle
          const spoiler = payload?.analysisData?.thumbnailSpoiler
          const hasSummary = typeof summary === 'string' && summary.trim().length > 0
          const hasSpoiler = Array.isArray(spoiler) ? spoiler.length > 0 : Boolean(spoiler)
          return hasSummary || hasSpoiler
        }

        const schedulePhase2Reveal = (immediate = false) => {
          if (phase2ReadyRef.current || phase2TimerRef.current !== null) {
            if (immediate && !phase2ReadyRef.current) {
              if (phase2TimerRef.current !== null) {
                window.clearTimeout(phase2TimerRef.current)
                phase2TimerRef.current = null
              }
              phase2ReadyRef.current = true
              setShowPhase2(true)
            }
            return
          }
          
          if (immediate) {
            phase2ReadyRef.current = true
            setShowPhase2(true)
            return
          }

          phase2TimerRef.current = window.setTimeout(() => {
            if (isCancelled) return
            phase2ReadyRef.current = true
            setShowPhase2(true)
            // [사용자 요청] 자막 요약은 기본 접힌 채로 등장

            if (completedWaitingPhase3Ref.current && phase3TimerRef.current === null) {
              phase3TimerRef.current = window.setTimeout(() => {
                if (isCancelled) return
                setShowPhase3(true)
                setIsRefining(false)
              }, 500)
            }
          }, 1300)
        }

        const schedulePhase3Reveal = (immediate = false) => {
          if (phase3TimerRef.current !== null || showPhase3) {
            if (immediate && !showPhase3) {
              if (phase3TimerRef.current !== null) {
                window.clearTimeout(phase3TimerRef.current)
                phase3TimerRef.current = null
              }
              setShowPhase3(true)
              setIsRefining(false)
            }
            return
          }

          if (immediate) {
            setShowPhase3(true)
            setIsRefining(false)
            return
          }

          if (phase2ReadyRef.current) {
            phase3TimerRef.current = window.setTimeout(() => {
              if (isCancelled) return
              setShowPhase3(true)
              setIsRefining(false)
            }, 500)
            return
          }
          completedWaitingPhase3Ref.current = true
        }

        const isCompletedOnFirstFetch = isCompletedPayload(data)
        if (!isCancelled) {
          setAnalysisData(data.analysisData)
          setLoading(false)
          window.dispatchEvent(new CustomEvent('creditsUpdated'))
          if (hasSpeedPayload(data)) {
            schedulePhase2Reveal(isCompletedOnFirstFetch)
          }
        }

        if (!isCompletedOnFirstFetch && !isCancelled) {
          setIsRefining(true)
        }

        if (!isCompletedPayload(data)) {
          for (let i = 0; i < 40; i++) {
            if (isCancelled) break
            await new Promise((resolve) => setTimeout(resolve, 1500))
            const retryRes = await fetch(`/api/analysis/result/${id}?${liteQuery}`, {
              cache: 'no-store'
            })
            if (!retryRes.ok) continue
            data = await retryRes.json()

            if (hasSpeedPayload(data) && !phase2ReadyRef.current && phase2TimerRef.current === null) {
              schedulePhase2Reveal()
            }

            if (!isCancelled) {
              setAnalysisData(data.analysisData)
              window.dispatchEvent(new CustomEvent('creditsUpdated'))
            }

            if (isCompletedPayload(data)) break
          }
        }
        
        if (!isCancelled) {
          const isCompletedNow = isCompletedPayload(data)
          setIsRefining(!isCompletedNow)
          setAnalysisData(data.analysisData)

          if (isCompletedNow) {
            window.dispatchEvent(new CustomEvent('creditsUpdated'))
            schedulePhase3Reveal(isCompletedOnFirstFetch)
          }

          if (isCompletedNow) {
            const fullRes = await fetch(`/api/analysis/result/${id}${fullQuery}`, {
              cache: 'no-store'
            })
            if (fullRes.ok) {
              data = await fullRes.json()
              if (!isCancelled) {
                setAnalysisData(data.analysisData)
                const anonAnalysisCount = typeof window !== 'undefined' ? parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10) : 0;
                if (isAnonymousUser() && anonAnalysisCount >= 1) {
                  import("@/src/services/merlin-hub-sdk/react").then(m => m.markFreeTrialCompleted())
                }
              }
            }
          }

          if (!hasCountedView.current) {
            hasCountedView.current = true;

            const claimUid = getUserId()
            if (claimUid) {
              fetch('/api/analysis/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysisId: id, userId: claimUid })
              }).catch(() => {})
            }

            fetch('/api/analysis/view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ analysisId: id })
            }).catch(err => console.error('View counting failed:', err));

            const trackUid = getUserId()
            if (trackUid) {
              console.log('[subscription/track] sending', { analysisId: id, userId: trackUid })
              fetch('/api/subscription/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysisId: id, userId: trackUid })
              })
                .then(async (res) => {
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok) {
                    console.error('[subscription/track] failed', res.status, data)
                    return
                  }
                  if (data?.skipped) {
                    console.warn('[subscription/track] skipped', data)
                  }
                })
                .catch(err => console.error('Subscription tracking failed:', err))
            }
          }

        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.")
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    // [대기제로 3단계] id가 없고 url만 있는 경우: pending 플로우로 id 확보 후 fetch 진행
    const bootstrap = async () => {
      if (isLoading) return;

      if (!id && urlParam) {
        if (pendingStartedRef.current) return
        pendingStartedRef.current = true
        try {
          const resolvedId = await runPendingFlow(urlParam, fromParam)
          if (isCancelled) return
          id = resolvedId
          // URL 정리: ?id=... 로 교체 (history API → useSearchParams 재발화 안 됨)
          if (typeof window !== 'undefined') {
            const nu = new URL(window.location.href)
            nu.searchParams.set('id', resolvedId)
            nu.searchParams.delete('url')
            nu.searchParams.delete('from')
            window.history.replaceState({}, '', nu.toString())
          }
        } catch (e: any) {
          if (!isCancelled) {
            const statusCode = Number(e?.statusCode)
            const errorData = e?.data
            if (statusCode === 402 && errorData?.insufficientCredits === true) {
              alert('보유하신 코인이 부족합니다. 충전 페이지로 이동합니다.')
              router.replace('/payment/purchase?redirectUrl=%2F')
              return
            }
            if (statusCode === 422 && errorData?.cached === true) {
              if (e?.message) alert(String(e.message))
              router.replace('/')
              return
            }
            setError(e?.message || '분석 시작에 실패했습니다.')
            setLoading(false)
          }
          return
        }
      }
      if (id && !isCancelled) {
        fetchAnalysisData()
      }
    }

    bootstrap()

    return () => {
      isCancelled = true;
      if (phase2TimerRef.current !== null) {
        clearTimeout(phase2TimerRef.current)
        phase2TimerRef.current = null
      }
      if (phase3TimerRef.current !== null) {
        clearTimeout(phase3TimerRef.current)
        phase3TimerRef.current = null
      }
    };
  }, [searchParams, isLoading])

  useEffect(() => {
    const nickname = localStorage.getItem("userNickname")
    if (nickname) setCurrentUser(nickname)

    const handleProfileUpdate = () => {
      const updatedNickname = localStorage.getItem("userNickname")
      if (updatedNickname) setCurrentUser(updatedNickname)
    }
    window.addEventListener("profileUpdated", handleProfileUpdate)
    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdate)
    }
  }, [])



  const requireLogin = (action: "like" | "comment", callback: () => void) => {
    if (isAnonymousUser()) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return false
    }
    callback()
    return true
  }



  const getTrafficLightImage = (score: number) => {
    if (score >= 70) return "/images/traffic-light-green.png"
    if (score >= 40) return "/images/traffic-light-yellow.png"
    return "/images/traffic-light-red.png"
  }



  const toggleTooltip = (tooltipId: string) => {
    setActiveTooltip(activeTooltip === tooltipId ? null : tooltipId)
  }

  const [showShareModal, setShowShareModal] = useState(false)

  const handleShare = () => {
    if (!analysisData) return
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile && navigator.share) {
      navigator.share({
        title: "어그로필터 - AI가 검증하는 신뢰도 분석",
        text: `📊 분석 결과: 신뢰도 ${analysisData.scores.trust}점 | 정확성 ${analysisData.scores.accuracy}% | 어그로성 ${analysisData.scores.clickbait}%`,
        url: window.location.href,
      }).catch(() => {})
    } else {
      setShowShareModal(true)
    }
  }

  const handleBack = () => {
    const returnToParam = searchParams.get("returnTo")
    const returnTo = returnToParam && returnToParam.startsWith("/") ? returnToParam : null
    const from = searchParams.get("from")
    const tab = searchParams.get("tab")
    if (returnTo) {
      router.push(returnTo)
    } else if (from && tab) {
      router.push(`/${from}?tab=${tab}`)
    } else {
      router.back()
    }
  }

  const parseTimestamp = (text: string) => {
    if (!text || typeof text !== 'string') return 0;
    const parts = text.split(":").map(Number);
    let seconds = 0;
    if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    return seconds;
  };

  const handleTimestampClick = (timestamp: string) => {
    const seconds = parseTimestamp(timestamp);
    setPlayerTime(seconds);
    setShowPlayer(true);
    // 플레이어가 나타나면 해당 위치로 스크롤 (필요 시)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderTextWithTimestamps = (text: string) => {
    if (!text) return null;
    
    // AI가 실수로 포함한 JSON 기호들({" , "}, ",") 강제 제거
    const cleanedText = text.replace(/^\{"|^\s*\{"|"\s*\}$|\}$|","$/g, '').trim();
    
    const timestampRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/g;
    
    // 1. 먼저 텍스트를 타임스탬프 기준으로 분할하여 모든 세그먼트를 추출
    const segments = cleanedText.split(timestampRegex);
    
    // 2. 세그먼트들을 순회하며 타임스탬프와 그 뒤의 텍스트를 그룹화
    const chapters: { ts: string; content: string }[] = [];
    let currentTs = "0:00";
    let currentContent = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.match(timestampRegex)) {
        // 새로운 타임스탬프 발견 시 이전 챕터 저장 (내용이 있을 때만)
        if (currentContent.trim()) {
          chapters.push({ ts: currentTs, content: currentContent.trim() });
        }
        currentTs = segment;
        currentContent = "";
      } else {
        currentContent += segment;
      }
    }
    // 마지막 챕터 추가
    if (currentContent.trim()) {
      chapters.push({ ts: currentTs, content: currentContent.trim() });
    }

    return chapters.map((chapter, idx) => {
      // Parse subtopic and summary (format: "소주제 ||| 요약문장" or "소주제: 요약문장")
      let subtopic: string | null = null;
      let summaryText = chapter.content;

      // New format: " - [Subtopic]\nContent" or " - 소주제: 내용"
      const cleanContent = chapter.content.replace(/^(\s*[\-\s]\s*)+/, '').trim();
      
      // 1. Check for "[Subtopic]" pattern
      if (cleanContent.startsWith('[')) {
        const endBracketIdx = cleanContent.indexOf(']');
        if (endBracketIdx > 0) {
          subtopic = cleanContent.substring(1, endBracketIdx).trim();
          summaryText = cleanContent.substring(endBracketIdx + 1).trim();
        }
      } 
      // 2. Fallback to "\n" (OpenAI Speed Track format)
      else if (cleanContent.includes('\n')) {
        const lines = cleanContent.split('\n');
        subtopic = lines[0].trim();
        summaryText = lines.slice(1).join('\n').trim();
      }
      // 3. Fallback to "|||" or ":"
      else if (cleanContent.includes('|||')) {
        const parts = cleanContent.split('|||');
        subtopic = parts[0].trim();
        summaryText = parts[1].trim();
      } else if (cleanContent.includes(':')) {
        const colonIdx = cleanContent.indexOf(':');
        if (colonIdx > 0 && colonIdx < 30) {
          subtopic = cleanContent.substring(0, colonIdx).trim();
          summaryText = cleanContent.substring(colonIdx + 1).trim();
        }
      }

      return (
        <div key={idx} className="mb-6 last:mb-0 text-left border-l-4 border-blue-100 pl-5 py-0.5">
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <button
              onClick={() => handleTimestampClick(chapter.ts)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 font-bold text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-all shrink-0 border border-blue-200/50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span className="text-xs font-bold">{chapter.ts}</span>
            </button>
            {subtopic && (
              <span className="font-bold text-slate-900 text-base tracking-tight">
                {subtopic}
              </span>
            )}
          </div>
          <div className="text-slate-600 leading-relaxed text-sm md:text-base font-normal">
            {summaryText}
          </div>
        </div>
      );
    });
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    
    return lines.map((line, lineIdx) => {
      const trimmedLine = line.trim();
      const isHeading = /^\d+\.\s/.test(trimmedLine);
      
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const renderedLine = parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2);
          return (
            <mark key={`${lineIdx}-${i}`} className="bg-yellow-100 text-gray-900 px-0.5 rounded-sm font-semibold" style={{ textDecoration: 'none' }}>
              {inner}
            </mark>
          );
        }
        return <span key={`${lineIdx}-${i}`}>{part}</span>;
      });

      if (isHeading) {
        return (
          <div key={lineIdx} className="text-base font-bold text-blue-600 mt-4 mb-1.5 first:mt-0">
            {renderedLine}
          </div>
        );
      }

      return (
        <div key={lineIdx} className="mb-1 last:mb-0 text-sm md:text-base font-normal text-slate-600">
          {renderedLine}
        </div>
      );
    });
  };

  const renderSpoilerText = (text: string) => {
    if (!text) return null;
    return <p className="text-sm md:text-base font-normal leading-relaxed text-gray-800">{text.replace(/\[스포(?:일러)?\]\s*/g, '')}</p>;
  };

  const handleYouthService = () => {
    const age = Number.parseInt(youthAge)
    if (isNaN(age) || age < 8 || age > 18) {
      alert("8세에서 18세 사이의 나이를 입력해주세요.")
      return
    }
    if (!analysisData) return
    const title = analysisData.videoTitle || ""
    const content = analysisData.fullSubtitle || analysisData.summarySubtitle || analysisData.summary || ""
    const prompt = `[청소년 프롬프트: ${age}세 맞춤형 분석 및 인터랙티브 튜터]
1. 역할: 당신은 청소년을 위한 친절한 디지털 리터러시 선생님입니다.
2. 미션: 아래 분석 결과를 바탕으로 ${age}세 학생에게 알기 쉽게 설명하고, 비판적 사고를 기르는 퀴즈를 진행해주세요.
[입력 데이터]
- 채널명: ${analysisData.channelName}
- 제목: ${title}
- 카테고리: ${analysisData.topic}
- 정확성: ${analysisData.scores.accuracy}점
- 어그로성: ${analysisData.scores.clickbait}점
- 신뢰도: ${analysisData.scores.trust}점
- 평가이유(성인용): ${analysisData.evaluationReason}
[자막 전문]
${content}
[지침 1. 나이에 맞는 설명]
성인용 '평가이유'를 ${age}세 수준에 맞게 아주 쉽게 풀어서 설명해주세요.
[지침 2. 신호등 총평]
신뢰도 점수(${analysisData.scores.trust}점)에 따라 신호등 색상으로 친구에게 추천할지 조언해주세요.
[지침 3. 상호작용 퀴즈 (중요)]
설명이 끝난 후, 아이가 스스로 생각할 수 있는 퀴즈를 **한 번에 1개씩만** 출제합니다. (총 3문제)
[출력 포맷]
1. [채널명/제목/카테고리] 요약
2. [점수] 정확성/어그로성/신뢰도
3. [평가 이유] (${age}세 맞춤 설명)
4. [신호등 총평]
5. [오늘의 퀴즈 1번]`
    const encodedPrompt = encodeURIComponent(prompt)
    if (encodedPrompt.length < 3500) {
      window.open(`https://chatgpt.com/?q=${encodedPrompt}`, "_blank")
    } else {
      navigator.clipboard.writeText(prompt).then(() => {
        alert("내용이 길어서 URL 전송 한도를 초과했습니다.\n\n클립보드에 복사되었습니다! 📋\nChatGPT가 열리면 '붙여넣기(Ctrl+V)' 해주세요.")
        window.open("https://chatgpt.com", "_blank")
      }).catch(err => {
        window.open("https://chatgpt.com", "_blank")
      })
    }
  }

  // [대기제로 3단계] 썸네일 히어로 (id 확보 전: 기존 스피너 대신 큰 썸네일 + 안내)
  // pendingThumb 가 있으면 항상 우선 노출. 분석 데이터 도착 전까지 사라지지 않음.
  if (loading && !analysisData) {
    if (pendingThumb) {
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <AppHeader />
          <main className="flex-1 py-4">
            <div className="mx-auto max-w-[var(--app-max-width)] space-y-3 px-4">
              <div className="hero-fade-up hero-scan-wrap border border-slate-900/40 shadow-2xl">
                <div className="relative aspect-video w-full bg-slate-100">
                  <img
                    src={pendingThumb}
                    alt="영상 썸네일"
                    className="hero-glitch h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-400/40 bg-slate-900/95 px-4 py-3 text-cyan-100 shadow-lg">
                <p className="text-sm font-bold flex items-center justify-center tracking-tight font-mono">
                  <TypewriterText text="이 영상 썸네일 스포일러를 추출하고 있습니다" />
                  <span className="hero-caret" aria-hidden="true" />
                </p>
              </div>
              <AnalysisGuide />
            </div>
          </main>
        </div>
      )
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500">분석 결과를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !analysisData) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-6 rounded-full bg-red-50 p-6">
            <span className="text-5xl">⚠️</span>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">분석에 실패했습니다</h2>
          <p className="mb-8 max-w-sm text-gray-600">
            {error || "데이터를 찾을 수 없거나 분석 중 오류가 발생했습니다."}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button 
              onClick={() => router.push("/")}
              className="w-full py-6 text-lg font-bold shadow-xl rounded-2xl"
            >
              홈으로 돌아가기
            </Button>
            <p className="text-xs text-gray-400">문제가 지속되면 고객센터로 문의해주세요.</p>
          </div>
        </div>
      </div>
    )
  }

  const topPercentile = analysisData.channelStats?.topPercentile
  const hasTopPercentile = typeof topPercentile === "number" && !Number.isNaN(topPercentile)
  const channelRank = analysisData.channelStats?.rank
  const totalChannels = analysisData.channelStats?.totalChannels
  const evaluationReasonText = typeof analysisData.evaluationReason === 'string' ? analysisData.evaluationReason : ''
  const channelRankText = typeof channelRank === "number" && !Number.isNaN(channelRank) ? `${channelRank}위` : "-"
  const totalChannelsText = typeof totalChannels === "number" && !Number.isNaN(totalChannels) ? `${totalChannels}개` : "-"
  const topPercentileText = hasTopPercentile ? `${Math.round(topPercentile)}%` : "-"
  const isSpeedPhase = showPhase2 && !showPhase3 && (isRefining || analysisData?.processingStage !== 'completed')
  const topPercentileFillWidth = hasTopPercentile && channelRank && totalChannels
    ? `${Math.max(0, Math.min(100, 100 - ((channelRank - 1) / totalChannels) * 100))}%`
    : "0%"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      {analysisData && (
        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          title={`어그로필터 - ${analysisData.videoTitle}`}
          description={`📊 신뢰도 ${analysisData.scores.trust}점 | 정확성 ${analysisData.scores.accuracy}% | 어그로성 ${analysisData.scores.clickbait}%`}
          url={typeof window !== 'undefined' ? window.location.href : ''}
        />
      )}
      <main className="pt-4 pb-8">
        <div className="mx-auto max-w-[var(--app-max-width)] space-y-4 px-4">
          <div ref={captureRef} className="bg-blue-50 p-4 rounded-3xl">
          <div className="bg-background pb-2 pt-2">
            <AnalysisHeader
              channelImage={analysisData.channelImage}
              channelName={analysisData.channelName}
              title={analysisData.videoTitle}
              videoUrl={analysisData.url}
              date={analysisData.date}
              onBack={handleBack}
              onChannelClick={() => router.push(`/p-ranking?category=${analysisData.officialCategoryId}&channel=${analysisData.channelId}&lang=${analysisData.channelLanguage || 'korean'}`)}
              onHeaderClick={() => setShowPlayer(!showPlayer)}
              channelLanguage={analysisData.channelLanguage}
            />
            {/* YouTube Embed Player - Conditional and Non-Sticky */}
            {showPlayer && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl border-4 border-white/20">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${analysisData.videoId}?start=${playerTime}&autoplay=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                  <button 
                    onClick={() => setShowPlayer(false)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

            {showPhase2 && (
            <>
              <div className="bg-background pb-3 pt-0">
                <SubtitleButtons 
                  activeSubtitle={activeSubtitle} 
                  onToggle={() => setActiveSubtitle(activeSubtitle === "summary" ? null : "summary")}
                  chapterCount={analysisData.summarySubtitle ? (analysisData.summarySubtitle.match(/(\d{1,2}:\d{2}(?::\d{2})?)/g) || []).length : 0}
                />
              </div>
              {activeSubtitle === "summary" && (
                <div className="overflow-hidden rounded-3xl border-4 border-blue-300 bg-blue-50">
                  <div className="max-h-[60vh] overflow-y-auto p-5">
                    <div className="whitespace-pre-line text-sm leading-relaxed">
                      {renderTextWithTimestamps(analysisData.summarySubtitle)}
                    </div>
                  </div>
                </div>
              )}
              {analysisData.thumbnailSpoiler && (
                <div className="rounded-3xl border-4 border-amber-400 bg-amber-50 px-3 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <h3 className="text-base font-bold text-gray-900">썸네일 스포일러</h3>
                  </div>
                  {Array.isArray(analysisData.thumbnailSpoiler) ? (
                    <div className="space-y-2">
                      {analysisData.thumbnailSpoiler.map((item: { topic?: string; text: string; ts?: string | null }, idx: number) => (
                        <div key={idx} className="rounded-2xl border-2 border-amber-200 bg-white px-4 py-3">
                          <div className="flex items-start gap-3">
                            {analysisData.thumbnailSpoiler.length > 1 && (
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-white">{idx + 1}</span>
                            )}
                            <div className="flex-1">
                              {item.topic && (
                                <p className="mb-1 text-base font-bold text-amber-600">📌 {item.topic}</p>
                              )}
                              {renderSpoilerText(item.text)}
                              {item.ts && (
                                <button
                                  onClick={() => handleTimestampClick(item.ts!)}
                                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  {item.ts} 부터 보기
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-amber-200 bg-white px-4 py-3">
                      {renderSpoilerText(analysisData.thumbnailSpoiler)}
                      {analysisData.thumbnailSpoilerTs && (
                        <button
                          onClick={() => handleTimestampClick(analysisData.thumbnailSpoilerTs!)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {analysisData.thumbnailSpoilerTs} 부터 보기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {isSpeedPhase && (
                <div className="cyber-panel-intense rounded-2xl border border-cyan-300/60 bg-slate-900/95 px-4 py-3 text-cyan-100 shadow-2xl">
                  <p className="cyber-text-intense text-sm font-bold flex items-center justify-center tracking-tight font-mono">
                    <TypewriterText text="정밀 분석 보고서를 생성하고 있습니다" perChar={45} startDelay={0} />
                    <span className="hero-caret" aria-hidden="true" />
                  </p>
                </div>
              )}
            </>
          )}

          {/* [대기제로 3단계] 스피드 결과 도착 전: 큰 썸네일 + 사이버펑크 안내 (B안) */}
          {!showPhase2 && !showPhase3 && (pendingThumb || analysisData?.thumbnail || analysisData?.videoId) && (
            <>
              <div className="hero-fade-up hero-scan-wrap border border-slate-900/40 shadow-2xl">
                <div className="relative aspect-video w-full bg-slate-100">
                  <img
                    src={
                      pendingThumb
                        || analysisData?.thumbnail
                        || (analysisData?.videoId ? `https://img.youtube.com/vi/${analysisData.videoId}/hqdefault.jpg` : '')
                    }
                    alt="영상 썸네일"
                    className="hero-glitch h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-400/40 bg-slate-900/95 px-4 py-3 text-cyan-100 shadow-lg">
                <p className="text-sm font-bold flex items-center justify-center tracking-tight font-mono">
                  <TypewriterText text="이 영상 썸네일 스포일러를 추출하고 있습니다" />
                  <span className="hero-caret" aria-hidden="true" />
                </p>
              </div>
            </>
          )}

          {/* 분석 가이드를 썸네일 하단으로 이동 (정밀 분석 전까지 노출) */}
          {!showPhase3 && <AnalysisGuide />}

          {showPhase3 && (
            <>
              <ScoreCard 
              accuracy={analysisData.scores.accuracy} 
              clickbait={analysisData.scores.clickbait} 
              trust={analysisData.scores.trust} 
              topic={getCategoryName(analysisData.officialCategoryId)}
              trafficLightImage={getTrafficLightImage(analysisData.scores.trust)}
              recheckDelta={analysisData.isRecheck && analysisData.recheckParentScores ? {
                before: analysisData.recheckParentScores,
                after: {
                  accuracy: analysisData.scores.accuracy ?? null,
                  clickbait: analysisData.scores.clickbait ?? null,
                  trust: analysisData.scores.trust ?? null,
                },
              } : undefined}
            />
          <div className="relative rounded-3xl bg-blue-100 px-3 py-3">
            <div className="rounded-3xl border-4 border-blue-400 bg-white p-4">
              <div className={`leading-relaxed whitespace-pre-line ${!showMore ? 'line-clamp-4' : ''}`}>
                {renderHighlightedText(
                  evaluationReasonText
                    .replace(/(어그로성\s*평가\s*\(\s*\d+\s*점)\s*\/\s*[^)]+\)/g, '$1)')
                    .split('<br />').join('\n')
                )}
                {showMore && <span className="ml-1"> {analysisData.overallAssessment}</span>}
              </div>
              <button
                onClick={() => setShowMore(!showMore)}
                className="mt-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {showMore ? '접기 ▲' : '더 보기 ▼'}
              </button>
            </div>
          </div>
          {analysisData.scores.clickbait >= 30 && analysisData.aiRecommendedTitle && (
            <div className="rounded-3xl border-4 border-gray-300 bg-blue-50 px-3 py-2">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-bold">AI 추천 제목</h3>
                <span className="text-xs text-muted-foreground">(어그로성 30% ↑ 일 때만)</span>
              </div>
              <div className="rounded-2xl border-2 border-blue-200 bg-white px-3 py-2">
                <p className="text-sm font-medium leading-relaxed">{analysisData.aiRecommendedTitle}</p>
              </div>
            </div>
          )}
          <div
            onClick={() => router.push(`/p-ranking?category=${analysisData.officialCategoryId}&channel=${analysisData.channelId}&lang=${analysisData.channelLanguage || 'korean'}`)}
            className="rounded-3xl border-4 border-indigo-300 bg-indigo-50 px-3 py-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-100 transition-colors"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <h3 className="text-base font-bold text-gray-800">카테고리 랭킹</h3>
                <div className="relative">
                  <button
                    onMouseEnter={() => setActiveTooltip("ranking")}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleTooltip("ranking")
                    }}
                    className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[10px] text-gray-500 hover:bg-gray-100"
                  >
                    ?
                  </button>
                  {activeTooltip === "ranking" && (
                    <div className="absolute left-1/2 bottom-full z-20 mb-2 w-64 -translate-x-1/2 rounded-lg border-2 border-gray-300 bg-white p-3 shadow-lg">
                      <p className="text-xs leading-relaxed text-gray-700">공식 카테고리 내에서 채널의 신뢰도 순위입니다.</p>
                      <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-gray-300 bg-white"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                {analysisData.channelLanguage && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-600 border border-blue-200">
                    {analysisData.channelLanguage.charAt(0).toUpperCase() + analysisData.channelLanguage.slice(1)}
                  </span>
                )}
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-600 border border-indigo-200">#{getCategoryName(analysisData.officialCategoryId)}</span>
                <span className="text-base font-bold text-indigo-600">상위 {topPercentileText}</span>
                <span className="text-sm font-medium text-gray-500">({channelRankText} / {totalChannelsText})</span>
              </div>
            </div>

            <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-indigo-100 border border-indigo-200">
              <div 
                className={hasTopPercentile ? "h-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-1000" : "h-full bg-slate-200"}
                style={{ width: topPercentileFillWidth }}
              />
            </div>

            <div className="rounded-2xl border-2 border-indigo-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-full border border-gray-200">
                    <Image 
                      src={analysisData.channelImage} 
                      alt={analysisData.channelName} 
                      width={32} 
                      height={32} 
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-800 flex-1 min-w-0">
                    {analysisData.channelName}
                  </span>
                </div>
                <div className="flex gap-3">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">정확성</div>
                    <div className="text-sm font-bold text-purple-600">
                      {typeof analysisData.channelStats?.avgAccuracy === 'number' ? `${Math.round(analysisData.channelStats.avgAccuracy)}%` : "-"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">어그로</div>
                    <div className="text-sm font-bold text-pink-500">
                      {typeof analysisData.channelStats?.avgClickbait === 'number' ? `${Math.round(analysisData.channelStats.avgClickbait)}%` : "-"}
                    </div>
                  </div>
                  <div className="text-center bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 scale-110 origin-right ml-1">
                    <div className="text-[10px] font-bold text-indigo-400">신뢰도</div>
                    <div className="text-base font-black text-indigo-700 leading-tight">
                      {typeof analysisData.channelStats?.avgReliability === 'number' ? `${Math.round(analysisData.channelStats.avgReliability)}점` : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border-4 border-teal-300 bg-teal-50 px-3 py-2">
            <div className="mb-2 flex items-center gap-1">
              <h3 className="text-base font-bold text-gray-800">&lt;청소년 서비스&gt;</h3>
              <div className="relative">
                <button
                  onMouseEnter={() => setActiveTooltip("youth")}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() => toggleTooltip("youth")}
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[10px] text-gray-500 hover:bg-gray-100"
                >
                  ?
                </button>
                {activeTooltip === "youth" && (
                  <div className="absolute left-1/2 top-full z-20 mt-2 w-80 -translate-x-1/2 rounded-lg border-2 border-gray-300 bg-white p-3 shadow-lg">
                    <p className="text-xs leading-relaxed text-gray-700">
                      &lt;청소년의 미디어 리터러시 교육용 서비스&gt;
                      <br />( )속에 8 ~ 18의 나이를 넣고 &apos;클릭&apos; 하면 ChatGPT가 선생님이 되어, 나의
                      나이에 맞는 설명과 간단한 퀴즈를 보여줘요.
                    </p>
                    <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-gray-300 bg-white"></div>
                  </div>
                )}
              </div>
            </div>
            <div className="w-full rounded-2xl border-2 border-teal-200 bg-white px-4 py-3">
              <div className="flex items-center gap-1 text-sm leading-relaxed text-gray-800">
                <span>내 나이</span>
                <input
                  type="text"
                  value={youthAge}
                  onChange={(e) => setYouthAge(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleYouthService()
                    }
                  }}
                  placeholder="8~18"
                  className="w-16 rounded border border-gray-300 px-2 py-0.5 text-center text-sm font-semibold focus:border-teal-400 focus:outline-none"
                />
                <button 
                  onClick={handleYouthService}
                  className="flex items-center gap-1 hover:text-teal-600 hover:underline hover:font-bold transition-all"
                >
                  <span>세 맞춤설명과 퀴즈보러가기</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>

          </>
          )}
        </div>
        </div>
      </main>
    </div>
  )
}
