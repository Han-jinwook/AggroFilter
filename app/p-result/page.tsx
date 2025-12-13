"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/c-button"
import { AppHeader, checkLoginStatus } from "@/components/c-app-header"
import { LoginModal } from "@/components/c-login-modal"
import { AnalysisHeader } from "@/app/p-result/c-result/analysis-header"
import { SubtitleButtons } from "@/app/p-result/c-result/subtitle-buttons"
import { ScoreCard } from "@/app/p-result/c-result/score-card"
import { InteractionBar } from "@/app/p-result/c-result/interaction-bar"
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, MoreVertical, ChevronLeft, Share2 } from "lucide-react"

export default function ResultPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showMore, setShowMore] = useState(false)
  const [activeSubtitle, setActiveSubtitle] = useState<"full" | "summary" | null>(null)
  const [youthAge, setYouthAge] = useState("")
  const [newComment, setNewComment] = useState("")
  const [isCommentFocused, setIsCommentFocused] = useState(false)
  const [comments, setComments] = useState([
    {
      id: "comment1",
      author: "@분석은정해",
      date: "2025.03.01",
      time: "12:30",
      text: "이 분석이 가장 정확하네요!",
      likes: 5,
      dislikes: 0,
      replies: [],
    },
    {
      id: "comment2",
      author: "@분석조아",
      date: "2025.02.30",
      time: "11:07",
      text: "참 봤습니다",
      likes: 8,
      dislikes: 1,
      replies: [
        {
          id: "reply1",
          author: "@정보왕",
          date: "2025.02.30",
          time: "14:22",
          text: "저도 유익했어요!",
          replyTo: "@분석조아",
          likes: 2,
          dislikes: 0,
        },
        {
          id: "reply2",
          author: "@분석은정해",
          date: "2025.03.01",
          time: "09:15",
          text: "동감합니다 👍",
          replyTo: "@분석조아",
          likes: 3,
          dislikes: 0,
        },
      ],
    },
    {
      id: "comment3",
      author: "@귀여운영희씨",
      date: "2025.02.27",
      time: "10:15",
      text: "신뢰방송만 분석잘\n쓰실 장합",
      likes: 0,
      dislikes: 0,
      replies: [],
    },
    {
      id: "comment4",
      author: "@clickbait00",
      date: "2025.02.27",
      time: "10:15",
      text: "좋은 정보 감사합니다",
      likes: 1,
      dislikes: 0,
      replies: [],
    },
  ])
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [likeCount, setLikeCount] = useState(9)
  const [dislikeCount, setDislikeCount] = useState(0)
  const [showReplies, setShowReplies] = useState<{ [key: string]: boolean }>({})
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const currentUser = "@chiu3"
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginTrigger, setLoginTrigger] = useState<"like" | "comment" | null>(null)

  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = searchParams.get("id")
    if (!id) {
      setError("분석 ID가 없습니다.")
      setLoading(false)
      return
    }

    const fetchAnalysisData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/analysis/result/${id}`)
        if (!response.ok) {
          throw new Error("분석 결과를 불러오는데 실패했습니다.")
        }
        const data = await response.json()
        setAnalysisData(data.analysisData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.")
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysisData()
  }, [searchParams])

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
    if (!checkLoginStatus()) {
      setLoginTrigger(action)
      setShowLoginModal(true)
      return false
    }
    callback()
    return true
  }

  const handleLoginSuccess = (email: string) => {
    const nickname = email.split("@")[0]
    localStorage.setItem("userEmail", email)
    localStorage.setItem("userNickname", nickname)
    window.dispatchEvent(new CustomEvent("profileUpdated"))

    setShowLoginModal(false)

    if (loginTrigger === "like") {
      handleLikeClick()
    } else if (loginTrigger === "comment") {
      setIsCommentFocused(true)
    }
    setLoginTrigger(null)
  }

  const handleLikeClick = () => {
    if (disliked) setDislikeCount(dislikeCount - 1)
    setLiked(!liked)
    setDisliked(false)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)
  }

  const handleDislikeClick = () => {
    if (liked) setLikeCount(likeCount - 1)
    setDisliked(!disliked)
    setLiked(false)
    setDislikeCount(disliked ? dislikeCount - 1 : dislikeCount + 1)
  }

  const handleCommentFocus = () => {
    requireLogin("comment", () => setIsCommentFocused(true))
  }

  const getTrafficLightImage = (score: number) => {
    if (score >= 70) return "/images/traffic-light-green.png"
    if (score >= 51) return "/images/traffic-light-yellow.png"
    return "/images/traffic-light-red.png"
  }

  const handleCommentSubmit = () => {
    if (newComment.trim()) {
      const newCommentObj = {
        id: `comment${comments.length + 1}`,
        author: currentUser,
        date: new Date().toLocaleDateString("ko-KR").replace(/\. /g, ".").slice(0, -1),
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
        text: newComment,
        likes: 0,
        dislikes: 0,
        replies: [],
      }
      setComments([newCommentObj, ...comments])
      setNewComment("")
      setIsCommentFocused(false)
    }
  }

  const handleReplySubmit = (commentId: string) => {
    if (replyText.trim()) {
      const updatedComments = comments.map((comment) => {
        if (comment.id === commentId) {
          const parentAuthor = comment.author
          const newReply = {
            id: `reply${comment.replies.length + 1}`,
            author: currentUser,
            date: new Date().toLocaleDateString("ko-KR").replace(/\. /g, ".").slice(0, -1),
            time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
            text: replyText,
            replyTo: parentAuthor,
            likes: 0,
            dislikes: 0,
            replies: [],
          }
          return {
            ...comment,
            replies: [...comment.replies, newReply],
          }
        }
        return comment
      })
      setComments(updatedComments)
      setReplyText("")
      setReplyingTo(null)
      setShowReplies({ ...showReplies, [commentId]: true })
    }
  }

  const toggleTooltip = (tooltipId: string) => {
    setActiveTooltip(activeTooltip === tooltipId ? null : tooltipId)
  }

  const handleShare = async () => {
    if (!analysisData) return

    const shareData = {
      title: "어그로필터 - AI가 검증하는 신뢰도 분석",
      text: `AI가 검증하는 어그로필터!\n유튜브 어그로 영상과 기사뉴스, 이에 나이에 맞게!\n\n📊 분석 결과:\n• 신뢰도 점수: ${analysisData.scores.trust}\n• 정확성: ${analysisData.scores.accuracy}%\n• 어그로성: ${analysisData.scores.clickbait}%\n\n제공 서비스:\n- 자막 전문/요약\n- 분석보고 (정확성과 어그로성 신뢰도 점수 및 평가)\n- 채널 순위\n\n우리가족 슬기로운 유튜브 생활 🚦\n\n${window.location.href}`,
      url: window.location.href,
    }

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
        console.log("[v0] 공유 성공 - Web Share API 사용")
      } else {
        const textToCopy = `${shareData.title}\n\n${shareData.text}`
        await navigator.clipboard.writeText(textToCopy)
        alert("📋 링크가 클립보드에 복사되었습니다!")
        console.log("[v0] 공유 성공 - 클립보드 복사")
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          console.log("[v0] 사용자가 공유를 취소함")
        } else {
          console.error("[v0] 공유 중 오류:", err)
          alert("공유 기능을 사용할 수 없습니다. 브라우저 설정을 확인해주세요.")
        }
      }
    }
  }

  const handleBack = () => {
    const from = searchParams.get("from")
    const tab = searchParams.get("tab")
    if (from && tab) {
      router.push(`/${from}?tab=${tab}`)
    } else {
      router.back()
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} onLoginSuccess={handleLoginSuccess} />

      <main className="container px-4 py-6 pt-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="space-y-2">
            <AnalysisHeader
              channelImage={analysisData.channelImage}
              channelName={analysisData.channelName}
              title={analysisData.videoTitle}
              videoUrl={analysisData.url}
              date={analysisData.date}
              onBack={handleBack}
              onChannelClick={() => router.push("/p-ranking")}
            />
          </div>

          <div className={`${activeSubtitle ? "sticky top-20 z-40" : ""} bg-background pb-3 pt-0`}>
            <SubtitleButtons 
              activeSubtitle={activeSubtitle} 
              onToggle={(type) => setActiveSubtitle(activeSubtitle === type ? null : type)} 
            />
          </div>

          {activeSubtitle === "full" && (
            <div className="overflow-hidden rounded-3xl border-4 border-gray-300 bg-blue-50">
              <div className="max-h-[60vh] overflow-y-auto p-5">
                <p className="whitespace-pre-line text-sm leading-relaxed">{analysisData.fullSubtitle}</p>
              </div>
            </div>
          )}

          {activeSubtitle === "summary" && (
            <div className="overflow-hidden rounded-3xl border-4 border-blue-300 bg-blue-50">
              <div className="max-h-[60vh] overflow-y-auto p-5">
                <p className="whitespace-pre-line text-sm leading-relaxed">{analysisData.summarySubtitle}</p>
              </div>
            </div>
          )}

          <ScoreCard 
              accuracy={analysisData.scores.accuracy} 
              clickbait={analysisData.scores.clickbait} 
              trust={analysisData.scores.trust} 
              trafficLightImage={getTrafficLightImage(analysisData.scores.trust)}
            />

          <div className="w-full py-4">
            <div className="flex h-[100px] w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
              <span className="text-sm font-medium text-gray-400">Middle Banner Ad (320x100)</span>
            </div>
          </div>

          <div className="relative rounded-3xl bg-blue-100 px-3 py-3">
            <div className="rounded-3xl border-4 border-blue-400 bg-white p-4">
              <p className={`text-sm leading-relaxed ${!showMore ? 'line-clamp-4' : ''}`}>
                {analysisData.evaluationReason}
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
            onClick={() => router.push("/p-ranking")}
            className="rounded-3xl border-4 border-indigo-300 bg-indigo-50 px-3 py-2 cursor-pointer hover:border-indigo-400 hover:bg-indigo-100 transition-colors"
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <h3 className="text-base font-bold text-gray-800">채널 평가</h3>
                <div className="relative">
                  <button
                    onMouseEnter={() => setActiveTooltip("channel")}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleTooltip("channel")
                    }}
                    className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[10px] text-gray-500 hover:bg-gray-100"
                  >
                    ?
                  </button>
                  {activeTooltip === "channel" && (
                    <div className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border-2 border-gray-300 bg-white p-3 shadow-lg">
                      <p className="text-xs leading-relaxed text-gray-700">해당 주제 분석 영상들의 평균값</p>
                      <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-gray-300 bg-white"></div>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-600">(해당주제 한정)</span>
            </div>

            <div className="rounded-2xl border-2 border-indigo-200 bg-white px-3 py-2">
              <div className="flex items-center justify-around leading-none">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-gray-800">정확성</span>
                  <span className="text-lg font-bold text-purple-600">100%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-gray-800">어그로성</span>
                  <span className="text-lg font-bold text-pink-500">50%</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1 pt-1 leading-none">
                <span className="text-sm font-bold text-gray-800">신뢰도 점수</span>
                <span className="text-lg font-bold text-pink-500">75</span>
                <span className="text-green-500">●</span>
              </div>
              <div className="mt-1 border-t border-gray-200 pt-1 text-center leading-none">
                <p className="text-sm">
                  <span className="text-lg font-bold text-pink-500">12</span>
                  <span className="text-gray-600"> 위 / </span>
                  <span className="text-gray-700">33 채널 </span>
                  <span className="font-semibold text-gray-700">(서울경제TV)</span>
                </p>
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
                  <MoreVertical className="h-4 w-4 text-gray-600" />
                </button>
                {activeTooltip === "youth" && (
                  <div className="absolute left-1/2 top-full z-20 mt-2 w-80 -translate-x-1/2 rounded-lg border-2 border-gray-300 bg-white p-3 shadow-lg">
                    <p className="text-xs leading-relaxed text-gray-700">
                      &lt;청소년의 미디어 리터러시 교육용 서비스&gt;
                      <br />( )속에 6 ~ 19의 나이를 넣고 '클릭' 하면 chatGPT나 재미나이 앱이 별도로 열리면서, 나의
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
                  placeholder="6~19"
                  className="w-16 rounded border border-gray-300 px-2 py-0.5 text-center text-sm font-semibold focus:border-teal-400 focus:outline-none"
                />
                <span>세 맞춤설명과 퀴즈보러가기</span>
                <span className="ml-1">→</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
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
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold">
                C
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onFocus={handleCommentFocus}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleCommentSubmit()
                    }
                  }}
                  placeholder="댓글 추가..."
                  className="w-full border-b-2 border-gray-300 bg-transparent px-1 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
                {isCommentFocused && (
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setNewComment("")
                        setIsCommentFocused(false)
                      }}
                      className="rounded-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleCommentSubmit}
                      disabled={!newComment.trim()}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        newComment.trim()
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      댓글
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-400 text-white text-sm font-bold">
                    {comment.author[1]}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{comment.author}</span>
                      <span className="text-xs text-gray-500">
                        {comment.date} {comment.time}
                      </span>
                      {comment.author === currentUser && (
                        <div className="relative ml-auto">
                          <button
                            onClick={() => setCommentMenuOpen(commentMenuOpen === comment.id ? null : comment.id)}
                            className="p-1 rounded-full hover:bg-gray-100"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600" />
                          </button>
                          {commentMenuOpen === comment.id && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-32 rounded-lg border border-gray-200 bg-white shadow-lg">
                              <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                ✏️ 수정
                              </button>
                              <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                                🗑️ 삭제
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="mb-2 whitespace-pre-line text-sm text-gray-900">{comment.text}</p>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => requireLogin("like", () => {})}
                          className="p-1 rounded-full hover:bg-gray-100"
                        >
                          <ThumbsUp className="h-4 w-4 text-gray-600" />
                        </button>
                        <span className="text-xs text-gray-600">{comment.likes}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => requireLogin("like", () => {})}
                          className="p-1 rounded-full hover:bg-gray-100"
                        >
                          <ThumbsDown className="h-4 w-4 text-gray-600" />
                        </button>
                        {comment.dislikes > 0 && <span className="text-xs text-gray-600">{comment.dislikes}</span>}
                      </div>
                      <button
                        onClick={() =>
                          requireLogin("comment", () => setReplyingTo(replyingTo === comment.id ? null : comment.id))
                        }
                        className="px-3 py-1 rounded-full text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        답글
                      </button>
                    </div>

                    {replyingTo === comment.id && (
                      <div className="mt-3 flex items-start gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold">
                          C
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handleReplySubmit(comment.id)
                              }
                            }}
                            placeholder="답글 추가..."
                            autoFocus
                            className="w-full border-b-2 border-gray-300 bg-transparent px-1 py-1 text-sm focus:border-gray-900 focus:outline-none"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setReplyText("")
                                setReplyingTo(null)
                              }}
                              className="rounded-full px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleReplySubmit(comment.id)}
                              disabled={!replyText.trim()}
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                replyText.trim()
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              답글
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {comment.replies.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => setShowReplies({ ...showReplies, [comment.id]: !showReplies[comment.id] })}
                          className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded px-2 py-1"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${showReplies[comment.id] ? "rotate-180" : ""}`}
                          />
                          {showReplies[comment.id] ? "답글 숨기기" : `답글 ${comment.replies.length}개`}
                        </button>

                        {showReplies[comment.id] && (
                          <div className="mt-3 space-y-3">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="flex items-start gap-3">
                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-300 text-gray-700 text-xs font-bold">
                                  {reply.author[1]}
                                </div>
                                <div className="flex-1">
                                  <div className="mb-1 flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900">{reply.author}</span>
                                    <span className="text-xs text-gray-500">
                                      {reply.date} {reply.time}
                                    </span>
                                    {reply.author === currentUser && (
                                      <div className="relative ml-auto">
                                        <button
                                          onClick={() =>
                                            setCommentMenuOpen(commentMenuOpen === reply.id ? null : reply.id)
                                          }
                                          className="p-1 rounded-full hover:bg-gray-100"
                                        >
                                          <MoreVertical className="h-3 w-3 text-gray-600" />
                                        </button>
                                        {commentMenuOpen === reply.id && (
                                          <div className="absolute right-0 top-full z-10 mt-1 w-32 rounded-lg border border-gray-200 bg-white shadow-lg">
                                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                              ✏️ 수정
                                            </button>
                                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                                              🗑️ 삭제
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <p className="mb-2 text-sm text-gray-900">
                                    <span className="font-semibold text-blue-600">{reply.replyTo}</span> {reply.text}
                                  </p>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <button className="p-1 rounded-full hover:bg-gray-100">
                                        <ThumbsUp className="h-3 w-3 text-gray-600" />
                                      </button>
                                      <span className="text-xs text-gray-600">{reply.likes}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button className="p-1 rounded-full hover:bg-gray-100">
                                        <ThumbsDown className="h-3 w-3 text-gray-600" />
                                      </button>
                                    </div>
                                    <button className="px-2 py-0.5 rounded-full text-xs font-semibold text-gray-700 hover:bg-gray-100">
                                      답글
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[60px] items-center justify-center border-t border-gray-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <span className="text-sm font-medium text-gray-400">Bottom Fixed Banner Ad (320x50)</span>
      </div>
    </div>
  )
}
