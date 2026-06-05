"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/c-button"
import { AppHeader, checkLoginStatus } from "@/components/c-app-header"
import { HubAuthModal } from "@/src/services/merlin-hub-sdk/react"
import { AnalysisHeader } from "@/app/p-result/c-result/analysis-header"
import { SubtitleButtons } from "@/app/p-result/c-result/subtitle-buttons"
import { ScoreCard } from "@/app/p-result/c-result/score-card"
import { InteractionBar } from "@/app/p-result/c-result/interaction-bar"
import { AnalysisGuide } from "@/app/p-result/c-result/analysis-guide"
import { getCategoryName } from "@/lib/constants"
import { calculateGap, calculateTier } from "@/lib/prediction-grading"
import { getUserId, isAnonymousUser } from "@/lib/anon"
import { ShareModal } from "@/components/c-share-modal"
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, MoreVertical, ChevronLeft, Share2, Play, Pencil, Trash2 } from "lucide-react"

function extractVideoId(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v') || url
  } catch {
    return url
  }
}

// [B?? ??먭린 ?④낵: 湲???⑥쐞濡?animation-delay ?곸슜???쒖감 reveal
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
  const hasCountedView = useRef(false)
  const [showMore, setShowMore] = useState(true)
  const [activeSubtitle, setActiveSubtitle] = useState<"summary" | null>("summary")
  const [youthAge, setYouthAge] = useState("")
  const [newComment, setNewComment] = useState("")
  const [isCommentFocused, setIsCommentFocused] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [dislikeCount, setDislikeCount] = useState(0)
  const [showReplies, setShowReplies] = useState<{ [key: string]: boolean }>({})
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState("")
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null)
  const [userNickname, setUserNickname] = useState<string>("")
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [loginTrigger, setLoginTrigger] = useState<"like" | "comment" | null>(null)
  const [playerTime, setPlayerTime] = useState(0)
  const [showPlayer, setShowPlayer] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null);

  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRefining, setIsRefining] = useState(false)
  const [showPhase2, setShowPhase2] = useState(false)
  const [showPhase3, setShowPhase3] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [predictionData, setPredictionData] = useState<any>(null)
  const [userPredictionStats, setUserPredictionStats] = useState<any>(null)
  // [?湲곗젣濡?3?④퀎] ?뺤옣??URL 吏꾩엯 ???몃꽕???덉뼱濡?  const [pendingThumb, setPendingThumb] = useState<string | null>(null)
  const pendingStartedRef = useRef(false)
  const hasSavedPrediction = useRef(false)
  const phase2TimerRef = useRef<number | null>(null)
  const phase3TimerRef = useRef<number | null>(null)
  const phase2ReadyRef = useRef(false)
  const completedWaitingPhase3Ref = useRef(false)

  useEffect(() => {
    const email = localStorage.getItem('userEmail')
    if (email && !isAnonymousUser()) {
      // DB?먯꽌 ?꾨줈???뺣낫 fetch (source of truth)
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
            setUserNickname(localStorage.getItem('userNickname') || '')
            setUserProfileImage(localStorage.getItem('userProfileImage'))
          }
        })
        .catch(() => {
          setUserNickname(localStorage.getItem('userNickname') || '')
          setUserProfileImage(localStorage.getItem('userProfileImage'))
        })
    } else {
      setUserNickname(localStorage.getItem('userNickname') || '寃뚯뒪??)
      setUserProfileImage(localStorage.getItem('userProfileImage') || '?맽')
    }
  }, [])

  useEffect(() => {
    setPredictionData(null); // ?댁쟾 ?덉륫 ?곗씠??珥덇린??    setIsRefining(false)
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

    // ?몃꽕???덉뼱濡?利됱떆 ?쒖떆 (id ?놁씠 url濡?吏꾩엯??寃쎌슦)
    if (!initialId && urlParam) {
      const vId = extractVideoId(urlParam)
      if (vId) {
        setPendingThumb(`https://img.youtube.com/vi/${vId}/hqdefault.jpg`)
      }
    }

    if (!initialId && !urlParam) {
      setError("遺꾩꽍 ID媛 ?놁뒿?덈떎.")
      setLoading(false)
      return
    }

    let isCancelled = false;
    let id: string | null = initialId

    // [?湲곗젣濡?3?④퀎] ?뺤옣??吏꾩엯??pending ?뚮줈??    const runPendingFlow = async (analysisUrl: string, from: string | null): Promise<string> => {
      // 1) ?뺤옣???먮쭑 ?섏떊 (理쒕? 8珥?
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

      // 2) ?ъ슜???앸퀎 / 1??泥댄뿕 ?쒗븳
      const currentEmail = localStorage.getItem('userEmail')
      let analysisUserId: string
      if (currentEmail) {
        analysisUserId = getUserId()
      } else {
        const trialCount = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10)
        if (trialCount >= 1) {
          window.dispatchEvent(new CustomEvent('openLoginModal'))
          throw new Error('濡쒓렇?몄씠 ?꾩슂?⑸땲??')
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
          const err: any = new Error(data?.error || '遺꾩꽍 ?붿껌???ㅽ뙣?덉뒿?덈떎.')
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

      if (!resolved?.analysisId) throw new Error('遺꾩꽍 寃곌낵瑜?諛쏆? 紐삵뻽?듬땲??')

      window.dispatchEvent(new CustomEvent('creditsUpdated'))
      if (isAnonymousUser()) {
        const count = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10) + 1
        localStorage.setItem('anonAnalysisCount', String(count))
        
        // 媛遺?湲덉븸 ???
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
          throw new Error("遺꾩꽍 寃곌낵瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎.")
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
            // [?ъ슜???붿껌] ?먮쭑 ?붿빟? 湲곕낯 ?묓엺 梨꾨줈 ?깆옣

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
                setUserPredictionStats(data.userPredictionStats || null)
                const anonAnalysisCount = typeof window !== 'undefined' ? parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10) : 0;
                if (isAnonymousUser() && anonAnalysisCount >= 1) {
                  import("@/src/services/merlin-hub-sdk/react").then(m => m.markFreeTrialCompleted())
                }
              }
            }

            /* REFACTORED: ?덉륫 ?댁쫰 ?쒖뒪???쒓굅 ?덉젙 (二쇱꽍 泥섎━)
            // Load prediction: sessionStorage (current session) or DB (past record)
            let matched = false
            try {
              const storedPrediction = sessionStorage.getItem('prediction_quiz_v1')
              if (storedPrediction) {
                const parsed = JSON.parse(storedPrediction)
                const videoUrl = data.analysisData?.url || ''
                if (parsed.url && videoUrl && (parsed.url === videoUrl || extractVideoId(parsed.url) === extractVideoId(videoUrl))) {
                  setPredictionData(parsed)
                  matched = true
                  // Save to DB if not already saved
                  if (!hasSavedPrediction.current && !data.videoPrediction) {
                    hasSavedPrediction.current = true
                    const predUid = getUserId()
                    const rawActualTrust = data.analysisData?.scores?.trust
                    const hasActualTrust = typeof rawActualTrust === 'number' && Number.isFinite(rawActualTrust)
                    const actualTrust = hasActualTrust ? rawActualTrust : NaN
                    const canSubmitPrediction =
                      predUid &&
                      hasActualTrust &&
                      parsed?.accuracy != null &&
                      parsed?.clickbait != null

                    if (canSubmitPrediction) {
                      fetch('/api/prediction/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          analysisId: id,
                          predictedAccuracy: parsed.accuracy,
                          predictedClickbait: parsed.clickbait,
                          actualReliability: actualTrust,
                          userId: predUid,
                        }),
                      })
                        .then(res => {
                          if (res.ok) {
                            // Re-fetch cumulative stats after successful save
                            return fetch(`/api/prediction/stats?id=${encodeURIComponent(predUid)}`)
                          }
                          return null
                        })
                        .then(res => res?.ok ? res.json() : null)
                        .then(stats => {
                          if (stats) {
                            setUserPredictionStats({
                              totalPredictions: stats.totalPredictions || 0,
                              avgGap: stats.avgGap ?? null,
                              currentTier: stats.currentTier || null,
                              currentTierLabel: stats.currentTierLabel || null,
                              tierEmoji: stats.tierEmoji || null,
                            })
                          }
                        })
                        .catch(err => console.error('Failed to save prediction:', err))
                    } else {
                      console.warn('[prediction/submit] skipped: invalid payload', {
                        hasUserId: Boolean(predUid),
                        hasAccuracy: parsed?.accuracy != null,
                        hasClickbait: parsed?.clickbait != null,
                        hasActualReliability: hasActualTrust,
                      })
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Failed to load prediction data:', e)
            }

            // Fallback: use DB record for this video
            if (!matched && data.videoPrediction) {
              setPredictionData({
                predictedReliability: data.videoPrediction.predictedReliability,
                accuracy: 0,
                clickbait: 0,
              })
            }
            */
          } else {
            setUserPredictionStats(null)
          }

          setComments(data.comments || [])
          setLikeCount(data.interaction?.likeCount || 0)
          setDislikeCount(data.interaction?.dislikeCount || 0)
          
          if (data.interaction?.userInteraction === 'like') {
              setLiked(true)
              setDisliked(false)
          } else if (data.interaction?.userInteraction === 'dislike') {
              setLiked(false)
              setDisliked(true)
          } else {
              setLiked(false)
              setDisliked(false)
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
          setError(err instanceof Error ? err.message : "?????녿뒗 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.")
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    // [?湲곗젣濡?3?④퀎] id媛 ?녾퀬 url留??덈뒗 寃쎌슦: pending ?뚮줈?곕줈 id ?뺣낫 ??fetch 吏꾪뻾
    const bootstrap = async () => {
      if (!id && urlParam) {
        if (pendingStartedRef.current) return
        pendingStartedRef.current = true
        try {
          const resolvedId = await runPendingFlow(urlParam, fromParam)
          if (isCancelled) return
          id = resolvedId
          // URL ?뺣━: ?id=... 濡?援먯껜 (history API ??useSearchParams ?щ컻??????
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
              alert('蹂댁쑀?섏떊 肄붿씤??遺議깊빀?덈떎. 異⑹쟾 ?섏씠吏濡??대룞?⑸땲??')
              router.replace('/payment/purchase?redirectUrl=%2F')
              return
            }
            if (statusCode === 422 && errorData?.cached === true) {
              if (e?.message) alert(String(e.message))
              router.replace('/')
              return
            }
            setError(e?.message || '遺꾩꽍 ?쒖옉???ㅽ뙣?덉뒿?덈떎.')
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
  }, [searchParams])

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

  useEffect(() => {
    const handleOpenLoginModal = () => {
      setShowLoginModal(true)
    }
    window.addEventListener("openLoginModal", handleOpenLoginModal)
    return () => {
      window.removeEventListener("openLoginModal", handleOpenLoginModal)
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

  const handleLoginSuccess = async (email: string, userId: string) => {
    localStorage.setItem("userEmail", email)
    if (userId) localStorage.setItem("userId", userId)

    // DB?먯꽌 ?꾨줈???뺣낫 fetch (source of truth)
    try {
      const res = await fetch(`/api/user/profile?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        if (data?.user) {
          const dbNickname = data.user.nickname || email.split("@")[0]
          const dbImage = data.user.image || ""
          localStorage.setItem("userNickname", dbNickname)
          localStorage.setItem("userProfileImage", dbImage)
          setUserNickname(dbNickname)
          setUserProfileImage(dbImage)
        } else {
          const nickname = email.split("@")[0]
          localStorage.setItem("userNickname", nickname)
          localStorage.setItem("userProfileImage", "")
          setUserNickname(nickname)
          setUserProfileImage("")
          await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, nickname, profileImage: null })
          })
        }
      }
    } catch (error) {
      const nickname = email.split("@")[0]
      localStorage.setItem("userNickname", nickname)
      localStorage.setItem("userProfileImage", "")
      setUserNickname(nickname)
      setUserProfileImage("")
    }

    window.dispatchEvent(new CustomEvent("profileUpdated"))

    setShowLoginModal(false)

    if (loginTrigger === "like") {
      handleLikeClick()
    } else if (loginTrigger === "comment") {
      setIsCommentFocused(true)
    }
    setLoginTrigger(null)
  }

  const handleLikeClick = async () => {
    if (!analysisData) return

    const previousLiked = liked
    const previousDisliked = disliked
    const previousLikeCount = likeCount
    const previousDislikeCount = dislikeCount

    if (disliked) setDislikeCount(dislikeCount - 1)
    setLiked(!liked)
    setDisliked(false)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)

    try {
        const response = await fetch('/api/interaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analysisId: analysisData.id,
                type: 'like',
                email: getUserId()
            })
        })
        const data = await response.json()
        if (data.success) {
            setLikeCount(data.likeCount)
            setDislikeCount(data.dislikeCount)
        } else {
             setLiked(previousLiked)
             setDisliked(previousDisliked)
             setLikeCount(previousLikeCount)
             setDislikeCount(previousDislikeCount)
        }
    } catch (e) {
        console.error(e)
        setLiked(previousLiked)
        setDisliked(previousDisliked)
        setLikeCount(previousLikeCount)
        setDislikeCount(previousDislikeCount)
    }
  }

  const handleDislikeClick = async () => {
    if (!analysisData) return

    const previousLiked = liked
    const previousDisliked = disliked
    const previousLikeCount = likeCount
    const previousDislikeCount = dislikeCount

    if (liked) setLikeCount(likeCount - 1)
    setDisliked(!disliked)
    setLiked(false)
    setDislikeCount(disliked ? dislikeCount - 1 : dislikeCount + 1)

    try {
        const response = await fetch('/api/interaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analysisId: analysisData.id,
                type: 'dislike',
                email: getUserId()
            })
        })
        const data = await response.json()
        if (data.success) {
            setLikeCount(data.likeCount)
            setDislikeCount(data.dislikeCount)
        } else {
             setLiked(previousLiked)
             setDisliked(previousDisliked)
             setLikeCount(previousLikeCount)
             setDislikeCount(previousDislikeCount)
        }
    } catch (e) {
        console.error(e)
        setLiked(previousLiked)
        setDisliked(previousDisliked)
        setLikeCount(previousLikeCount)
        setDislikeCount(previousDislikeCount)
    }
  }

  const handleCommentFocus = () => {
    requireLogin("comment", () => setIsCommentFocused(true))
  }

  const getTrafficLightImage = (score: number) => {
    if (score >= 70) return "/images/traffic-light-green.png"
    if (score >= 40) return "/images/traffic-light-yellow.png"
    return "/images/traffic-light-red.png"
  }

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return
    if (!analysisData) return
    if (isAnonymousUser()) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }
    const nickname = localStorage.getItem("userNickname") || '寃뚯뒪??
    const profileImg = localStorage.getItem("userProfileImage") || '?맽'
    const tempId = `temp_${Date.now()}`
    const optimisticComment = {
      id: tempId,
      text: newComment,
      author: nickname,
      profileImage: profileImg,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      dislikeCount: 0,
      replies: [],
    }
    setComments([optimisticComment, ...comments]);
    setNewComment("");
    setIsCommentFocused(false);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: analysisData.id,
          text: optimisticComment.text,
          nickname,
          userId: getUserId(),
          profileImage: profileImg
        })
      });
      if (!response.ok) throw new Error('Failed to post comment');
      const data = await response.json();
      if (data.success && data.comment) {
        setComments(prev => prev.map(c => c.id === tempId ? data.comment : c));
      }
    } catch (error) {
      console.error(error);
      setComments(prev => prev.filter(c => c.id !== tempId));
      alert('?볤? ?깅줉???ㅽ뙣?덉뒿?덈떎.');
    }
  }

  const handleReplySubmit = async (commentId: string) => {
    if (!replyText.trim()) return
    if (!analysisData) return
    if (isAnonymousUser()) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }
    const nickname = localStorage.getItem("userNickname") || '寃뚯뒪??
    const profileImg = localStorage.getItem("userProfileImage") || '?맽'
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: analysisData.id,
          text: replyText,
          nickname,
          parentId: commentId,
          userId: getUserId(),
          profileImage: profileImg
        })
      });
      if (!response.ok) throw new Error('Failed to post reply');
      const data = await response.json();
      if (data.success && data.comment) {
        const updatedComments = comments.map((comment) => {
          if (comment.id === commentId) {
             return {
               ...comment,
               replies: [...(comment.replies || []), { ...data.comment, replyTo: comment.author }]
             }
          }
          return comment
        })
        setComments(updatedComments)
        setReplyText("")
        setReplyingTo(null)
        setShowReplies({ ...showReplies, [commentId]: true })
      }
    } catch (error) {
      console.error(error);
      alert('?듦? ?깅줉???ㅽ뙣?덉뒿?덈떎.');
    }
  }

  const handleCommentLike = async (commentId: string) => {
    const uid = getUserId()
    if (!uid) return
    try {
      const response = await fetch('/api/comments/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, type: 'like', userId: uid })
      })
      if (!response.ok) throw new Error('Failed to like comment')
      const data = await response.json()
      if (data.success) {
        setComments(comments.map(c => 
          c.id === commentId 
            ? { ...c, likeCount: data.likeCount, dislikeCount: data.dislikeCount }
            : c
        ))
      }
    } catch (error) {
      console.error('Comment like error:', error)
    }
  }

  const handleCommentDislike = async (commentId: string) => {
    const uid = getUserId()
    if (!uid) return
    try {
      const response = await fetch('/api/comments/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, type: 'dislike', userId: uid })
      })
      if (!response.ok) throw new Error('Failed to dislike comment')
      const data = await response.json()
      if (data.success) {
        setComments(comments.map(c => 
          c.id === commentId 
            ? { ...c, likeCount: data.likeCount, dislikeCount: data.dislikeCount }
            : c
        ))
      }
    } catch (error) {
      console.error('Comment dislike error:', error)
    }
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
        title: "?닿렇濡쒗븘??- AI媛 寃利앺븯???좊ː??遺꾩꽍",
        text: `?뱤 遺꾩꽍 寃곌낵: ?좊ː??${analysisData.scores.trust}??| ?뺥솗??${analysisData.scores.accuracy}% | ?닿렇濡쒖꽦 ${analysisData.scores.clickbait}%`,
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
    // ?뚮젅?댁뼱媛 ?섑??섎㈃ ?대떦 ?꾩튂濡??ㅽ겕濡?(?꾩슂 ??
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderTextWithTimestamps = (text: string) => {
    if (!text) return null;
    
    // AI媛 ?ㅼ닔濡??ы븿??JSON 湲고샇??{" , "}, ",") 媛뺤젣 ?쒓굅
    const cleanedText = text.replace(/^\{"|^\s*\{"|"\s*\}$|\}$|","$/g, '').trim();
    
    const timestampRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/g;
    
    // 1. 癒쇱? ?띿뒪?몃? ??꾩뒪?ы봽 湲곗??쇰줈 遺꾪븷?섏뿬 紐⑤뱺 ?멸렇癒쇳듃瑜?異붿텧
    const segments = cleanedText.split(timestampRegex);
    
    // 2. ?멸렇癒쇳듃?ㅼ쓣 ?쒗쉶?섎ŉ ??꾩뒪?ы봽? 洹??ㅼ쓽 ?띿뒪?몃? 洹몃９??    const chapters: { ts: string; content: string }[] = [];
    let currentTs = "0:00";
    let currentContent = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.match(timestampRegex)) {
        // ?덈줈????꾩뒪?ы봽 諛쒓껄 ???댁쟾 梨뺥꽣 ???(?댁슜???덉쓣 ?뚮쭔)
        if (currentContent.trim()) {
          chapters.push({ ts: currentTs, content: currentContent.trim() });
        }
        currentTs = segment;
        currentContent = "";
      } else {
        currentContent += segment;
      }
    }
    // 留덉?留?梨뺥꽣 異붽?
    if (currentContent.trim()) {
      chapters.push({ ts: currentTs, content: currentContent.trim() });
    }

    return chapters.map((chapter, idx) => {
      // Parse subtopic and summary (format: "?뚯＜??||| ?붿빟臾몄옣" or "?뚯＜?? ?붿빟臾몄옣")
      let subtopic: string | null = null;
      let summaryText = chapter.content;

      // New format: " - [Subtopic]\nContent" or " - ?뚯＜?? ?댁슜"
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

  const handleYouthService = () => {
    const age = Number.parseInt(youthAge)
    if (isNaN(age) || age < 8 || age > 18) {
      alert("8?몄뿉??18???ъ씠???섏씠瑜??낅젰?댁＜?몄슂.")
      return
    }
    if (!analysisData) return
    const title = analysisData.videoTitle || ""
    const content = analysisData.fullSubtitle || analysisData.summarySubtitle || analysisData.summary || ""
    const prompt = `[泥?냼???꾨＼?꾪듃: ${age}??留욎땄??遺꾩꽍 諛??명꽣?숉떚釉??쒗꽣]
1. ??븷: ?뱀떊? 泥?냼?꾩쓣 ?꾪븳 移쒖젅???붿???由ы꽣?ъ떆 ?좎깮?섏엯?덈떎.
2. 誘몄뀡: ?꾨옒 遺꾩꽍 寃곌낵瑜?諛뷀깢?쇰줈 ${age}???숈깮?먭쾶 ?뚭린 ?쎄쾶 ?ㅻ챸?섍퀬, 鍮꾪뙋???ш퀬瑜?湲곕Ⅴ???댁쫰瑜?吏꾪뻾?댁＜?몄슂.
[?낅젰 ?곗씠??
- 梨꾨꼸紐? ${analysisData.channelName}
- ?쒕ぉ: ${title}
- 移댄뀒怨좊━: ${analysisData.topic}
- ?뺥솗?? ${analysisData.scores.accuracy}??- ?닿렇濡쒖꽦: ${analysisData.scores.clickbait}??- ?좊ː?? ${analysisData.scores.trust}??- ?됯??댁쑀(?깆씤??: ${analysisData.evaluationReason}
[?먮쭑 ?꾨Ц]
${content}
[吏移?1. ?섏씠??留욌뒗 ?ㅻ챸]
?깆씤??'?됯??댁쑀'瑜?${age}???섏???留욊쾶 ?꾩＜ ?쎄쾶 ??댁꽌 ?ㅻ챸?댁＜?몄슂.
[吏移?2. ?좏샇??珥앺룊]
?좊ː???먯닔(${analysisData.scores.trust}?????곕씪 ?좏샇???됱긽?쇰줈 移쒓뎄?먭쾶 異붿쿇?좎? 議곗뼵?댁＜?몄슂.
[吏移?3. ?곹샇?묒슜 ?댁쫰 (以묒슂)]
?ㅻ챸???앸궃 ?? ?꾩씠媛 ?ㅼ뒪濡??앷컖?????덈뒗 ?댁쫰瑜?**??踰덉뿉 1媛쒖뵫留?* 異쒖젣?⑸땲?? (珥?3臾몄젣)
[異쒕젰 ?щ㎎]
1. [梨꾨꼸紐??쒕ぉ/移댄뀒怨좊━] ?붿빟
2. [?먯닔] ?뺥솗???닿렇濡쒖꽦/?좊ː??3. [?됯? ?댁쑀] (${age}??留욎땄 ?ㅻ챸)
4. [?좏샇??珥앺룊]
5. [?ㅻ뒛???댁쫰 1踰?`
    const encodedPrompt = encodeURIComponent(prompt)
    if (encodedPrompt.length < 3500) {
      window.open(`https://chatgpt.com/?q=${encodedPrompt}`, "_blank")
    } else {
      navigator.clipboard.writeText(prompt).then(() => {
        alert("?댁슜??湲몄뼱??URL ?꾩넚 ?쒕룄瑜?珥덇낵?덉뒿?덈떎.\n\n?대┰蹂대뱶??蹂듭궗?섏뿀?듬땲?? ?뱥\nChatGPT媛 ?대━硫?'遺숈뿬?ｊ린(Ctrl+V)' ?댁＜?몄슂.")
        window.open("https://chatgpt.com", "_blank")
      }).catch(err => {
        window.open("https://chatgpt.com", "_blank")
      })
    }
  }

  // [?湲곗젣濡?3?④퀎] ?몃꽕???덉뼱濡?(id ?뺣낫 ?? 湲곗〈 ?ㅽ뵾????????몃꽕??+ ?덈궡)
  // pendingThumb 媛 ?덉쑝硫???긽 ?곗꽑 ?몄텧. 遺꾩꽍 ?곗씠???꾩갑 ?꾧퉴吏 ?щ씪吏吏 ?딆쓬.
  if (loading && !analysisData) {
    if (pendingThumb) {
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <AppHeader onLoginClick={() => setShowLoginModal(true)} />
          <main className="flex-1 py-4">
            <div className="mx-auto max-w-[var(--app-max-width)] space-y-3 px-4">
              <div className="hero-fade-up hero-scan-wrap border border-slate-900/40 shadow-2xl">
                <div className="relative aspect-video w-full bg-slate-100">
                  <img
                    src={pendingThumb}
                    alt="?곸긽 ?몃꽕??
                    className="hero-glitch h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-400/40 bg-slate-900/95 px-4 py-3 text-cyan-100 shadow-lg">
                <p className="text-sm font-bold flex items-center justify-center tracking-tight font-mono">
                  <TypewriterText text="???곸긽 ?몃꽕???ㅽ룷?쇰윭瑜?異붿텧?섍퀬 ?덉뒿?덈떎" />
                  <span className="hero-caret" aria-hidden="true" />
                </p>
              </div>
              <AnalysisGuide />
            </div>
          </main>
          <HubAuthModal 
            isOpen={showLoginModal} 
            onClose={() => setShowLoginModal(false)} 
            onSuccess={handleLoginSuccess} 
            appName="?닿렇濡쒗븘?? 
            appLogoUrl="/images/character-logo-ko.png" 
            subtitleActionText="遺꾩꽍?? 
          />
        </div>
      )
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500">遺꾩꽍 寃곌낵瑜?遺덈윭?ㅻ뒗 以?..</p>
        </div>
      </div>
    )
  }

  if (error || !analysisData) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader onLoginClick={() => setShowLoginModal(true)} />
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-6 rounded-full bg-red-50 p-6">
            <span className="text-5xl">?좑툘</span>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">遺꾩꽍???ㅽ뙣?덉뒿?덈떎</h2>
          <p className="mb-8 max-w-sm text-gray-600">
            {error || "?곗씠?곕? 李얠쓣 ???녾굅??遺꾩꽍 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎."}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button 
              onClick={() => router.push("/")}
              className="w-full py-6 text-lg font-bold shadow-xl rounded-2xl"
            >
              ?덉쑝濡??뚯븘媛湲?            </Button>
            <p className="text-xs text-gray-400">臾몄젣媛 吏?띾릺硫?怨좉컼?쇳꽣濡?臾몄쓽?댁＜?몄슂.</p>
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
  const channelRankText = typeof channelRank === "number" && !Number.isNaN(channelRank) ? `${channelRank}?? : "-"
  const totalChannelsText = typeof totalChannels === "number" && !Number.isNaN(totalChannels) ? `${totalChannels}媛? : "-"
  const topPercentileText = hasTopPercentile ? `${Math.round(topPercentile)}%` : "-"
  const isSpeedPhase = showPhase2 && !showPhase3 && (isRefining || analysisData?.processingStage !== 'completed')
  const topPercentileFillWidth = hasTopPercentile && channelRank && totalChannels
    ? `${Math.max(0, Math.min(100, 100 - ((channelRank - 1) / totalChannels) * 100))}%`
    : "0%"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />
      <HubAuthModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
        onSuccess={handleLoginSuccess} 
        appName="?닿렇濡쒗븘?? 
        appLogoUrl="/images/character-logo-ko.png" 
        subtitleActionText="遺꾩꽍?? 
      />

      {analysisData && (
        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          title={`?닿렇濡쒗븘??- ${analysisData.videoTitle}`}
          description={`?뱤 ?좊ː??${analysisData.scores.trust}??| ?뺥솗??${analysisData.scores.accuracy}% | ?닿렇濡쒖꽦 ${analysisData.scores.clickbait}%`}
          url={typeof window !== 'undefined' ? window.location.href : ''}
        />
      )}
      <main className="pt-6 pb-24">
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
                    <span className="text-lg">?렞</span>
                    <h3 className="text-base font-bold text-gray-900">?몃꽕???ㅽ룷?쇰윭</h3>
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
                                <p className="mb-1 text-base font-bold text-amber-600">?뱦 {item.topic}</p>
                              )}
                              <p className="text-sm md:text-base font-normal leading-relaxed text-gray-800">{item.text}</p>
                              {item.ts && (
                                <button
                                  onClick={() => handleTimestampClick(item.ts!)}
                                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  {item.ts} 遺??蹂닿린
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-amber-200 bg-white px-4 py-3">
                      <p className="text-sm md:text-base font-normal leading-relaxed text-gray-800">{analysisData.thumbnailSpoiler}</p>
                      {analysisData.thumbnailSpoilerTs && (
                        <button
                          onClick={() => handleTimestampClick(analysisData.thumbnailSpoilerTs!)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {analysisData.thumbnailSpoilerTs} 遺??蹂닿린
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {isSpeedPhase && (
                <div className="cyber-panel-intense rounded-2xl border border-cyan-300/60 bg-slate-900/95 px-4 py-3 text-cyan-100 shadow-2xl">
                  <p className="cyber-text-intense text-sm font-bold flex items-center justify-center tracking-tight font-mono">
                    <TypewriterText text="?뺣? 遺꾩꽍 蹂닿퀬?쒕? ?앹꽦?섍퀬 ?덉뒿?덈떎" perChar={45} startDelay={0} />
                    <span className="hero-caret" aria-hidden="true" />
                  </p>
                </div>
              )}
            </>
          )}

          {/* [?湲곗젣濡?3?④퀎] ?ㅽ뵾??寃곌낵 ?꾩갑 ?? ???몃꽕??+ ?ъ씠踰꾪럱???덈궡 (B?? */}
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
                    alt="?곸긽 ?몃꽕??
                    className="hero-glitch h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-400/40 bg-slate-900/95 px-4 py-3 text-cyan-100 shadow-lg">
                <p className="text-sm font-bold flex items-center justify-center tracking-tight font-mono">
                  <TypewriterText text="???곸긽 ?몃꽕???ㅽ룷?쇰윭瑜?異붿텧?섍퀬 ?덉뒿?덈떎" />
                  <span className="hero-caret" aria-hidden="true" />
                </p>
              </div>
            </>
          )}

          {/* 遺꾩꽍 媛?대뱶瑜??몃꽕???섎떒?쇰줈 ?대룞 (?뺣? 遺꾩꽍 ?꾧퉴吏 ?몄텧) */}
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
              prediction={predictionData && analysisData.scores.trust ? (() => {
                const gap = calculateGap(predictionData.predictedReliability, analysisData.scores.trust)
                const tierInfo = calculateTier(gap)
                return {
                  predictedReliability: predictionData.predictedReliability,
                  gap,
                  tier: tierInfo.tier,
                  tierLabel: tierInfo.label,
                  tierEmoji: tierInfo.emoji,
                  totalPredictions: userPredictionStats?.totalPredictions || 0,
                  avgGap: userPredictionStats?.avgGap ?? gap,
                  cumulativeTier: userPredictionStats?.currentTier || tierInfo.tier,
                  cumulativeTierLabel: userPredictionStats?.currentTierLabel || tierInfo.label,
                  cumulativeTierEmoji: userPredictionStats?.tierEmoji || tierInfo.emoji,
                }
              })() : undefined}
              userPredictionStats={userPredictionStats}
            />
          <div className="relative rounded-3xl bg-blue-100 px-3 py-3">
            <div className="rounded-3xl border-4 border-blue-400 bg-white p-4">
              <div className={`leading-relaxed whitespace-pre-line ${!showMore ? 'line-clamp-4' : ''}`}>
                {renderHighlightedText(
                  evaluationReasonText
                    .replace(/(?닿렇濡쒖꽦\s*?됯?\s*\(\s*\d+\s*??\s*\/\s*[^)]+\)/g, '$1)')
                    .split('<br />').join('\n')
                )}
                {showMore && <span className="ml-1"> {analysisData.overallAssessment}</span>}
              </div>
              <button
                onClick={() => setShowMore(!showMore)}
                className="mt-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {showMore ? '?묎린 ?? : '??蹂닿린 ??}
              </button>
            </div>
          </div>
          {analysisData.scores.clickbait >= 30 && analysisData.aiRecommendedTitle && (
            <div className="rounded-3xl border-4 border-gray-300 bg-blue-50 px-3 py-2">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-bold">AI 異붿쿇 ?쒕ぉ</h3>
                <span className="text-xs text-muted-foreground">(?닿렇濡쒖꽦 30% ?????뚮쭔)</span>
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
                <h3 className="text-base font-bold text-gray-800">移댄뀒怨좊━ ??궧</h3>
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
                      <p className="text-xs leading-relaxed text-gray-700">怨듭떇 移댄뀒怨좊━ ?댁뿉??梨꾨꼸???좊ː???쒖쐞?낅땲??</p>
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
                <span className="text-base font-bold text-indigo-600">?곸쐞 {topPercentileText}</span>
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
                    <div className="text-[10px] text-gray-500">?뺥솗??/div>
                    <div className="text-sm font-bold text-purple-600">{analysisData.channelStats?.avgAccuracy !== null ? `${Math.round(analysisData.channelStats?.avgAccuracy)}%` : "-"}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">?닿렇濡?/div>
                    <div className="text-sm font-bold text-pink-500">{analysisData.channelStats?.avgClickbait !== null ? `${Math.round(analysisData.channelStats?.avgClickbait)}%` : "-"}</div>
                  </div>
                  <div className="text-center bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 scale-110 origin-right ml-1">
                    <div className="text-[10px] font-bold text-indigo-400">?좊ː??/div>
                    <div className="text-base font-black text-indigo-700 leading-tight">
                      {analysisData.channelStats?.avgReliability !== null ? `${Math.round(analysisData.channelStats?.avgReliability)}?? : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border-4 border-teal-300 bg-teal-50 px-3 py-2">
            <div className="mb-2 flex items-center gap-1">
              <h3 className="text-base font-bold text-gray-800">&lt;泥?냼???쒕퉬??gt;</h3>
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
                      &lt;泥?냼?꾩쓽 誘몃뵒??由ы꽣?ъ떆 援먯쑁???쒕퉬??gt;
                      <br />( )?띿뿉 8 ~ 18???섏씠瑜??ｊ퀬 &apos;?대┃&apos; ?섎㈃ ChatGPT媛 ?좎깮?섏씠 ?섏뼱, ?섏쓽
                      ?섏씠??留욌뒗 ?ㅻ챸怨?媛꾨떒???댁쫰瑜?蹂댁뿬以섏슂.
                    </p>
                    <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-gray-300 bg-white"></div>
                  </div>
                )}
              </div>
            </div>
            <div className="w-full rounded-2xl border-2 border-teal-200 bg-white px-4 py-3">
              <div className="flex items-center gap-1 text-sm leading-relaxed text-gray-800">
                <span>???섏씠</span>
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
                  <span>??留욎땄?ㅻ챸怨??댁쫰蹂대윭媛湲?/span>
                  <span>??/span>
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-sm font-semibold text-blue-600">?닿렇濡쒗븘??AI遺꾩꽍 寃곌낵</p>
            <InteractionBar 
              liked={liked} 
              disliked={disliked} 
              likeCount={likeCount} 
              dislikeCount={dislikeCount} 
              onLike={() => requireLogin("like", handleLikeClick)} 
              onDislike={() => requireLogin("like", handleDislikeClick)} 
            />
          </div>
          <div className="rounded-3xl border-4 border-gray-300 bg-white p-5">
            <h3 className="mb-4 text-lg font-bold">{comments.length}媛쒖쓽 ?볤?</h3>
            <div className="mb-6 flex items-start gap-3">
              {userProfileImage && !userProfileImage.match(/^\p{Emoji}/u) ? (
                <Image
                  src={userProfileImage}
                  alt="Profile"
                  width={30}
                  height={30}
                  className="h-[30px] w-[30px] flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-lg">
                  {userProfileImage || (userNickname ? userNickname[0].toUpperCase() : 'U')}
                </div>
              )}
              <div className="flex-1 flex items-end gap-2">
                <textarea
                  rows={1}
                  value={newComment}
                  onChange={(e) => {
                    setNewComment(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onFocus={handleCommentFocus}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleCommentSubmit()
                    }
                  }}
                  placeholder="?볤? 異붽?..."
                  className="flex-1 border-b-2 border-gray-300 bg-transparent px-1 py-2 text-sm focus:border-gray-900 focus:outline-none resize-none overflow-hidden"
                />
                {isCommentFocused && (
                  <button
                    onClick={handleCommentSubmit}
                    className="text-sm text-blue-600 hover:text-blue-800 font-semibold pb-2"
                  >
                    ?깅줉
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <div className="flex items-start gap-3">
                    {comment.authorImage && !comment.authorImage.match(/^\p{Emoji}/u) ? (
                      <img
                        src={comment.authorImage}
                        alt={comment.author}
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-2xl">
                        {comment.authorImage || comment.author[0]}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{comment.author}</span>
                        <span className="text-xs text-gray-500">{comment.date} {comment.time}</span>
                        {comment.authorId === getUserId() && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingComment(comment.id)
                                setEditText(comment.text)
                              }}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm('?뺣쭚 ???볤?????젣?섏떆寃좎뒿?덇퉴?')) {
                                  try {
                                    const delUid = getUserId()
                                    const response = await fetch('/api/comments/delete', {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ commentId: comment.id, userId: delUid })
                                    })
                                    if (response.ok) {
                                      setComments(comments.filter(c => c.id !== comment.id))
                                    } else {
                                      alert('?볤? ??젣???ㅽ뙣?덉뒿?덈떎.')
                                    }
                                  } catch (error) {
                                    console.error('Delete error:', error)
                                    alert('?볤? ??젣???ㅽ뙣?덉뒿?덈떎.')
                                  }
                                }
                              }}
                              className="text-gray-500 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                      {editingComment === comment.id ? (
                        <div className="mt-2 flex items-start gap-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-1 border-b-2 border-gray-300 bg-transparent px-1 py-1 text-sm focus:border-gray-900 focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              setEditingComment(null)
                              setEditText("")
                            }}
                            className="text-xs text-gray-600 hover:text-gray-800"
                          >
                            痍⑥냼
                          </button>
                          <button
                            onClick={() => {
                              // TODO: Call update API
                              setComments(comments.map(c => 
                                c.id === comment.id ? { ...c, text: editText } : c
                              ))
                              setEditingComment(null)
                              setEditText("")
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            ???                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                        <button 
                          onClick={() => handleCommentLike(comment.id)}
                          className="flex items-center gap-1 hover:text-blue-600"
                        >
                          <ThumbsUp className="h-3 w-3" />
                          <span>{comment.likeCount || 0}</span>
                        </button>
                        <button 
                          onClick={() => handleCommentDislike(comment.id)}
                          className="flex items-center gap-1 hover:text-red-600"
                        >
                          <ThumbsDown className="h-3 w-3" />
                          <span>{comment.dislikeCount || 0}</span>
                        </button>
                        <button 
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          className="hover:text-blue-600"
                        >
                          ?듦?
                        </button>
                      </div>
                      {replyingTo === comment.id && (
                        <div className="mt-3 flex items-start gap-2">
                          <textarea
                            rows={1}
                            value={replyText}
                            onChange={(e) => {
                              setReplyText(e.target.value)
                              e.target.style.height = 'auto'
                              e.target.style.height = e.target.scrollHeight + 'px'
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handleReplySubmit(comment.id)
                              }
                            }}
                            placeholder="?듦? 異붽?..."
                            className="flex-1 border-b-2 border-gray-300 bg-transparent px-1 py-1 text-sm focus:border-gray-900 focus:outline-none resize-none overflow-hidden"
                          />
                          <button
                            onClick={() => handleReplySubmit(comment.id)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            ?깅줉
                          </button>
                        </div>
                      )}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {comment.replies.map((reply: any) => (
                            <div key={reply.id} className="flex items-start gap-2 pl-4 border-l-2 border-gray-200">
                              {reply.authorImage && !reply.authorImage.match(/^\p{Emoji}/u) ? (
                                <img
                                  src={reply.authorImage}
                                  alt={reply.author}
                                  className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-xl">
                                  {reply.authorImage || reply.author[0]}
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="text-xs font-semibold text-gray-900">{reply.author}</span>
                                  <span className="text-xs text-gray-500">{reply.date} {reply.time}</span>
                                  {reply.authorId === getUserId() && (
                                    <>
                                      <button 
                                        onClick={() => {
                                          setEditingComment(reply.id)
                                          setEditText(reply.text)
                                        }}
                                        className="text-gray-500 hover:text-gray-700"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if (confirm('?뺣쭚 ???듦?????젣?섏떆寃좎뒿?덇퉴?')) {
                                            try {
                                              const delReplyUid = getUserId()
                                              const response = await fetch('/api/comments/delete', {
                                                method: 'DELETE',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ commentId: reply.id, userId: delReplyUid })
                                              })
                                              if (response.ok) {
                                                setComments(comments.map(c => ({
                                                  ...c,
                                                  replies: c.replies?.filter((r: any) => r.id !== reply.id)
                                                })))
                                              } else {
                                                alert('?듦? ??젣???ㅽ뙣?덉뒿?덈떎.')
                                              }
                                            } catch (error) {
                                              console.error('Delete error:', error)
                                              alert('?듦? ??젣???ㅽ뙣?덉뒿?덈떎.')
                                            }
                                          }
                                        }}
                                        className="text-gray-500 hover:text-red-600"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                                {editingComment === reply.id ? (
                                  <div className="mt-2 flex items-start gap-2">
                                    <input
                                      type="text"
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      className="flex-1 border-b-2 border-gray-300 bg-transparent px-1 py-1 text-xs focus:border-gray-900 focus:outline-none"
                                    />
                                    <button
                                      onClick={() => {
                                        setEditingComment(null)
                                        setEditText("")
                                      }}
                                      className="text-xs text-gray-600 hover:text-gray-800"
                                    >
                                      痍⑥냼
                                    </button>
                                    <button
                                      onClick={() => {
                                        // TODO: Call update API
                                        setComments(comments.map(c => ({
                                          ...c,
                                          replies: c.replies?.map((r: any) => 
                                            r.id === reply.id ? { ...r, text: editText } : r
                                          )
                                        })))
                                        setEditingComment(null)
                                        setEditText("")
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      ???                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{reply.text}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
