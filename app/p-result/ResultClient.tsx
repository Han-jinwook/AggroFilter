"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/c-button"
import { AppHeader, checkLoginStatus } from "@/components/c-app-header"
import { LoginModal } from "@/components/c-login-modal"
import { AnalysisHeader } from "@/app/p-result/c-result/analysis-header"
import { SubtitleButtons } from "@/app/p-result/c-result/subtitle-buttons"
import { ScoreCard } from "@/app/p-result/c-result/score-card"
import { InteractionBar } from "@/app/p-result/c-result/interaction-bar"
import { getCategoryName } from "@/lib/constants"
import { calculateGap, calculateTier } from "@/lib/prediction-grading"
import { getUserId, getAnonNickname, getAnonEmoji, isAnonymousUser } from "@/lib/anon"
import { mergeAnonToEmail } from "@/lib/merge"
import { ShareModal } from "@/components/c-share-modal"
import { AccessibilityToolbar } from "@/components/c-accessibility-toolbar"
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

export default function ResultClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasCountedView = useRef(false)
  const [showMore, setShowMore] = useState(false)
  const [activeSubtitle, setActiveSubtitle] = useState<"summary" | null>(null)
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
  const [showBenefitModal, setShowBenefitModal] = useState(false)
  const [loginTrigger, setLoginTrigger] = useState<"like" | "comment" | null>(null)
  const [playerTime, setPlayerTime] = useState(0)
  const [showPlayer, setShowPlayer] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null);

  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [predictionData, setPredictionData] = useState<any>(null)
  const [userPredictionStats, setUserPredictionStats] = useState<any>(null)
  const hasSavedPrediction = useRef(false)

  useEffect(() => {
    const email = localStorage.getItem('userEmail')
    if (email && !isAnonymousUser()) {
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
            setUserNickname(localStorage.getItem('userNickname') || '')
            setUserProfileImage(localStorage.getItem('userProfileImage'))
          }
        })
        .catch(() => {
          setUserNickname(localStorage.getItem('userNickname') || '')
          setUserProfileImage(localStorage.getItem('userProfileImage'))
        })
    } else {
      // 익명 사용자: localStorage에 저장된 커스텀 값 우선
      setUserNickname(localStorage.getItem('userNickname') || getAnonNickname())
      setUserProfileImage(localStorage.getItem('userProfileImage') || getAnonEmoji())
    }
  }, [])

  useEffect(() => {
    setPredictionData(null); // 이전 예측 데이터 초기화
    const id = searchParams.get("id")
    if (!id) {
      setError("분석 ID가 없습니다.")
      setLoading(false)
      return
    }

    let isCancelled = false;

    const fetchAnalysisData = async () => {
      try {
        setLoading(true)
        const uid = getUserId()
        const response = await fetch(`/api/analysis/result/${id}${uid ? `?userId=${encodeURIComponent(uid)}` : ''}`, {
          cache: 'no-store'
        })
        
        if (!response.ok) {
          throw new Error("분석 결과를 불러오는데 실패했습니다.")
        }
        const data = await response.json()
        
        if (!isCancelled) {
          setAnalysisData(data.analysisData)
          setUserPredictionStats(data.userPredictionStats || null)

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
                  if (predUid) {
                    fetch('/api/prediction/submit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        analysisId: id,
                        predictedAccuracy: parsed.accuracy,
                        predictedClickbait: parsed.clickbait,
                        actualReliability: data.analysisData?.scores?.trust,
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

          // 익명 사용자 5회 이상 시 혜택 안내 모달 (5회마다 반복)
          if (isAnonymousUser()) {
            const count = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10);
            const shownAt = parseInt(localStorage.getItem('anonBenefitShownAt') || '0', 10);
            if (count >= 5 && count - shownAt >= 5) {
              setTimeout(() => setShowBenefitModal(true), 2000);
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

    fetchAnalysisData()

    return () => {
      isCancelled = true;
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
    // 익명 사용자도 허용 — 로그인 강제 안 함
    callback()
    return true
  }

  const handleLoginSuccess = async (email: string, userId: string) => {
    localStorage.setItem("userEmail", email)
    if (userId) localStorage.setItem("userId", userId)

    // 익명 데이터 → 이메일 계정으로 병합
    await mergeAnonToEmail(userId, email)

    // DB에서 프로필 정보 fetch (source of truth)
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
    const nickname = localStorage.getItem("userNickname") || getAnonNickname()
    const profileImg = localStorage.getItem("userProfileImage") || getAnonEmoji()
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
      alert('댓글 등록에 실패했습니다.');
    }
  }

  const handleReplySubmit = async (commentId: string) => {
    if (!replyText.trim()) return
    if (!analysisData) return
    const nickname = localStorage.getItem("userNickname") || getAnonNickname()
    const profileImg = localStorage.getItem("userProfileImage") || getAnonEmoji()
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
      alert('답글 등록에 실패했습니다.');
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
  const [largeFontMode, setLargeFontMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('largeFontMode') === 'true'
    }
    return false
  })

  const handleLargeFontToggle = (enabled: boolean) => {
    setLargeFontMode(enabled)
    localStorage.setItem('largeFontMode', String(enabled))
  }

  const buildTTSText = () => {
    if (!analysisData) return ''
    const parts: string[] = []
    parts.push(`분석 결과를 읽어드리겠습니다.`)
    parts.push(`영상 제목: ${analysisData.videoTitle}`)
    parts.push(`채널: ${analysisData.channelName}`)
    parts.push(`신뢰도 점수는 100점 만점에 ${analysisData.scores.trust}점입니다.`)
    parts.push(`정확성은 ${analysisData.scores.accuracy}퍼센트이고, 어그로성은 ${analysisData.scores.clickbait}퍼센트입니다.`)

    const trust = analysisData.scores.trust
    if (trust >= 70) {
      parts.push(`이 영상은 블루 등급으로, 비교적 신뢰할 수 있는 콘텐츠입니다.`)
    } else if (trust >= 40) {
      parts.push(`이 영상은 옐로우 등급으로, 주의가 필요한 콘텐츠입니다.`)
    } else {
      parts.push(`이 영상은 레드 등급으로, 신뢰도가 낮은 콘텐츠입니다. 주의하세요.`)
    }

    if (analysisData.evaluationReason) {
      const cleanReason = analysisData.evaluationReason
        .replace(/<br\s*\/?>/g, ' ')
        .replace(/\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (cleanReason.length <= 500) {
        parts.push(`평가 내용: ${cleanReason}`)
      } else {
        parts.push(`평가 내용: ${cleanReason.slice(0, 500)}`)
      }
    }

    if (analysisData.overallAssessment) {
      parts.push(`종합 평가: ${analysisData.overallAssessment}`)
    }

    return parts.join('. ')
  }

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
    const timestampRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/g;
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    return lines.map((line, lineIdx) => {
      // Find all timestamps in the line
      const lineTimestamps = line.match(timestampRegex);
      let contentToRender = line;
      let firstTimestamp: string | null = null;

      if (lineTimestamps && lineTimestamps.length > 0) {
        firstTimestamp = lineTimestamps[0];
        // Remove all timestamps from the content to render it separately
        contentToRender = line.replace(timestampRegex, '').replace(/^(\s*[:\-\s]\s*)+/, '').trim();
      }

      // Parse subtopic and summary (format: "소주제  요약문장")
      let subtopic: string | null = null;
      let summaryText = contentToRender;
      const parts = contentToRender.split('|||');
      if (parts.length >= 2) {
        subtopic = parts[0].trim();
        summaryText = parts[1].trim();
      } else {
        subtopic = null;
        summaryText = contentToRender;
      }

      return (
        <div key={lineIdx} className="mb-3 last:mb-0 text-left">
          <button
            onClick={() => handleTimestampClick(firstTimestamp!)}
            className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 transition-colors mr-2"
          >
            <Play className="w-3 h-3 fill-current" />
            {firstTimestamp}
          </button>
          {subtopic ? (
            <>
              <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md mr-2">{subtopic}</span>
              <span className="text-gray-700">{summaryText}</span>
            </>
          ) : (
            <span className="text-gray-700">{contentToRender}</span>
          )}
        </div>
      );
    });
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

  if (loading) {
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
        <AppHeader onLoginClick={() => setShowLoginModal(true)} />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-500 font-medium mb-2">⚠️ 오류 발생</p>
            <p className="text-gray-600 mb-4">{error || "데이터를 찾을 수 없습니다."}</p>
            <Button onClick={() => router.push("/")}>홈으로 돌아가기</Button>
          </div>
        </div>
      </div>
    )
  }

  const topPercentile = analysisData.channelStats?.topPercentile
  const hasTopPercentile = typeof topPercentile === "number" && !Number.isNaN(topPercentile)
  const channelRank = analysisData.channelStats?.rank
  const totalChannels = analysisData.channelStats?.totalChannels
  const channelRankText = typeof channelRank === "number" && !Number.isNaN(channelRank) ? `${channelRank}위` : "-"
  const totalChannelsText = typeof totalChannels === "number" && !Number.isNaN(totalChannels) ? `${totalChannels}개` : "-"
  const topPercentileText = hasTopPercentile ? `${Math.round(topPercentile)}%` : "-"
  const topPercentileFillWidth = hasTopPercentile && channelRank && totalChannels
    ? `${Math.max(0, Math.min(100, 100 - ((channelRank - 1) / totalChannels) * 100))}%`
    : "0%"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} onLoginSuccess={handleLoginSuccess} />

      {/* 혜택 안내 모달 */}
      {showBenefitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5">
            <div className="text-center">
              <div className="text-3xl mb-2">🎁</div>
              <h2 className="text-lg font-bold text-gray-900">이메일 등록하면 이런 게 좋아요!</h2>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-xl">💾</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">분석 데이터 영구 보존</div>
                  <div className="text-xs text-gray-500">기기를 바꿔도 내 분석 기록이 그대로</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">📱</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">PC · 모바일 어디서든</div>
                  <div className="text-xs text-gray-500">로그인만 하면 모든 기기에서 동일하게</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">🔔</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">채널 신뢰도 변동 알림</div>
                  <div className="text-xs text-gray-500">구독 채널 순위가 바뀌면 바로 알림</div>
                </div>
              </li>
            </ul>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  localStorage.setItem('anonBenefitShownAt', localStorage.getItem('anonAnalysisCount') || '0');
                  setShowBenefitModal(false);
                  setTimeout(() => setShowLoginModal(true), 200);
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
              >
                이메일 등록하기
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('anonBenefitShownAt', localStorage.getItem('anonAnalysisCount') || '0');
                  setShowBenefitModal(false);
                }}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                다음에 할게요
              </button>
            </div>
          </div>
        </div>
      )}
      {analysisData && (
        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          title={`어그로필터 - ${analysisData.videoTitle}`}
          description={`📊 신뢰도 ${analysisData.scores.trust}점 | 정확성 ${analysisData.scores.accuracy}% | 어그로성 ${analysisData.scores.clickbait}%`}
          url={typeof window !== 'undefined' ? window.location.href : ''}
        />
      )}
      <main className={`pt-6 pb-24 ${largeFontMode ? 'text-lg [&_.text-sm]:text-base [&_.text-xs]:text-sm [&_.text-\\[11px\\]]:text-xs [&_.text-\\[10px\\]]:text-xs [&_.text-base]:text-lg [&_.leading-relaxed]:leading-loose' : ''}`}>
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
          <div className="bg-background pb-3 pt-0">
            <SubtitleButtons 
              activeSubtitle={activeSubtitle} 
              onToggle={() => setActiveSubtitle(activeSubtitle === "summary" ? null : "summary")}
              chapterCount={analysisData.summarySubtitle ? analysisData.summarySubtitle.split('\n').filter(line => line.trim().length > 0 && line.match(/\d{1,2}:\d{2}/)).length : 0}
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
              accessibilityToolbar={
                <AccessibilityToolbar
                  ttsText={buildTTSText()}
                  onLargeFontToggle={handleLargeFontToggle}
                  largeFontEnabled={largeFontMode}
                />
              }
            />
          <div className="relative rounded-3xl bg-blue-100 px-3 py-3">
            <div className="rounded-3xl border-4 border-blue-400 bg-white p-4">
              <p className={`text-sm leading-relaxed whitespace-pre-line ${!showMore ? 'line-clamp-4' : ''}`}>
                {analysisData.evaluationReason
                  .replace(/(어그로성\s*평가\s*\(\s*\d+\s*점)\s*\/\s*[^)]+\)/g, '$1)')
                  .split('<br />').map((section, idx) => {
                    // Add paragraph breaks within each section for readability
                    const sentences = section.split(/\.\s+(?=[가-힣A-Z])/);
                    const formatted = sentences.map((s, i) => {
                      // Add line break after every 2-3 sentences
                      if (i > 0 && i % 2 === 0) return '\n' + s.trim();
                      return s.trim();
                    }).join('. ');
                    return idx === 0 ? formatted : '\n\n' + formatted;
                  }).join('')}
                {showMore && <span className="ml-1"> {analysisData.overallAssessment}</span>}
              </p>
              <button
                onClick={() => setShowMore(!showMore)}
                className="mt-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {showMore ? '접기 ▲' : '더 보기 ▼'}
              </button>
            </div>
          </div>
          {analysisData.scores.clickbait >= 30 && (
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
                    <div className="text-sm font-bold text-purple-600">{analysisData.channelStats?.avgAccuracy !== null ? `${Math.round(analysisData.channelStats?.avgAccuracy)}%` : "-"}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">어그로</div>
                    <div className="text-sm font-bold text-pink-500">{analysisData.channelStats?.avgClickbait !== null ? `${Math.round(analysisData.channelStats?.avgClickbait)}%` : "-"}</div>
                  </div>
                  <div className="text-center bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 scale-110 origin-right ml-1">
                    <div className="text-[10px] font-bold text-indigo-400">신뢰도</div>
                    <div className="text-base font-black text-indigo-700 leading-tight">
                      {analysisData.channelStats?.avgReliability !== null ? `${Math.round(analysisData.channelStats?.avgReliability)}점` : "-"}
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
          </div>
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-sm font-semibold text-blue-600">어그로필터 AI분석 결과</p>
            <InteractionBar 
              liked={liked} 
              disliked={disliked} 
              likeCount={likeCount} 
              dislikeCount={dislikeCount} 
              onLike={() => requireLogin("like", handleLikeClick)} 
              onDislike={() => requireLogin("like", handleDislikeClick)} 
              onShare={handleShare} 
            />
          </div>
          <div className="rounded-3xl border-4 border-gray-300 bg-white p-5">
            <h3 className="mb-4 text-lg font-bold">{comments.length}개의 댓글</h3>
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
                  placeholder="댓글 추가..."
                  className="flex-1 border-b-2 border-gray-300 bg-transparent px-1 py-2 text-sm focus:border-gray-900 focus:outline-none resize-none overflow-hidden"
                />
                {isCommentFocused && (
                  <button
                    onClick={handleCommentSubmit}
                    className="text-sm text-blue-600 hover:text-blue-800 font-semibold pb-2"
                  >
                    등록
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
                                if (confirm('정말 이 댓글을 삭제하시겠습니까?')) {
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
                                      alert('댓글 삭제에 실패했습니다.')
                                    }
                                  } catch (error) {
                                    console.error('Delete error:', error)
                                    alert('댓글 삭제에 실패했습니다.')
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
                            취소
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
                            저장
                          </button>
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
                          답글
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
                            placeholder="답글 추가..."
                            className="flex-1 border-b-2 border-gray-300 bg-transparent px-1 py-1 text-sm focus:border-gray-900 focus:outline-none resize-none overflow-hidden"
                          />
                          <button
                            onClick={() => handleReplySubmit(comment.id)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            등록
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
                                          if (confirm('정말 이 답글을 삭제하시겠습니까?')) {
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
                                                alert('답글 삭제에 실패했습니다.')
                                              }
                                            } catch (error) {
                                              console.error('Delete error:', error)
                                              alert('답글 삭제에 실패했습니다.')
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
                                      취소
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
                                      저장
                                    </button>
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
        </div>
      </main>
    </div>
  )
}
