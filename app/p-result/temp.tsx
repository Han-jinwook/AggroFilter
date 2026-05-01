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
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, MoreVertical, ChevronLeft, Share2, Play } from "lucide-react"

export default function ResultClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasCountedView = useRef(false)
  const [showMore, setShowMore] = useState(false)
  const [activeSubtitle, setActiveSubtitle] = useState<"full" | "summary" | null>(null)
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
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState("")
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginTrigger, setLoginTrigger] = useState<"like" | "comment" | null>(null)
  const [playerTime, setPlayerTime] = useState(0)
  const [showPlayer, setShowPlayer] = useState(false)

  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = searchParams.get("id")
    if (!id) {
      setError("遺꾩꽍 ID媛 ?놁뒿?덈떎.")
      setLoading(false)
      return
    }

    let isCancelled = false;

    const fetchAnalysisData = async () => {
      try {
        setLoading(true)
        const email = localStorage.getItem("userEmail")
        const url = email ? `/api/analysis/result/${id}?email=${email}` : `/api/analysis/result/${id}`
        
        const response = await fetch(url, {
          cache: 'no-store'
        })
        
        if (!response.ok) {
          throw new Error("遺꾩꽍 寃곌낵瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎.")
        }
        const data = await response.json()
        
        if (!isCancelled) {
          setAnalysisData(data.analysisData)
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
            fetch('/api/analysis/view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ analysisId: id })
            }).catch(err => console.error('View counting failed:', err));
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

  const handleLikeClick = async () => {
    if (!analysisData) return
    const email = localStorage.getItem("userEmail")
    if (!email) return

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
                email
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
    const email = localStorage.getItem("userEmail")
    if (!email) return

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
                email
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
    if (score >= 51) return "/images/traffic-light-yellow.png"
    return "/images/traffic-light-red.png"
  }

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return
    if (!analysisData) return
    const email = localStorage.getItem("userEmail")
    const nickname = localStorage.getItem("userNickname")
    if (!email) {
      requireLogin("comment", () => {})
      return
    }
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: analysisData.videoId,
          text: newComment,
          email,
          nickname
        })
      });
      if (!response.ok) throw new Error('Failed to post comment');
      const data = await response.json();
      if (data.success && data.comment) {
        setComments([data.comment, ...comments]);
        setNewComment("");
        setIsCommentFocused(false);
      }
    } catch (error) {
      console.error(error);
      alert('?볤? ?깅줉???ㅽ뙣?덉뒿?덈떎.');
    }
  }

  const handleReplySubmit = async (commentId: string) => {
    if (!replyText.trim()) return
    if (!analysisData) return
    const email = localStorage.getItem("userEmail")
    const nickname = localStorage.getItem("userNickname")
    if (!email) {
      requireLogin("comment", () => {})
      return
    }
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: analysisData.videoId,
          text: replyText,
          email,
          nickname,
          parentId: commentId
        })
      });
      if (!response.ok) throw new Error('Failed to post reply');
      const data = await response.json();
      if (data.success && data.comment) {
        const newReply = data.comment;
        const updatedComments = comments.map((comment) => {
          if (comment.id === commentId) {
             return {
               ...comment,
               replies: [...(comment.replies || []), { ...newReply, replyTo: comment.author }]
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

  const toggleTooltip = (tooltipId: string) => {
    setActiveTooltip(activeTooltip === tooltipId ? null : tooltipId)
  }

  const handleShare = async () => {
    if (!analysisData) return
    const shareData = {
      title: "?닿렇濡쒗븘??- AI媛 寃利앺븯???좊ː??遺꾩꽍",
      text: `AI媛 寃利앺븯???닿렇濡쒗븘??\n?좏뒠釉??닿렇濡??곸긽怨?湲곗궗?댁뒪, ?댁뿉 ?섏씠??留욊쾶!\n\n?뱤 遺꾩꽍 寃곌낵:\n???좊ː???먯닔: ${analysisData.scores.trust}\n???뺥솗?? ${analysisData.scores.accuracy}%\n???닿렇濡쒖꽦: ${analysisData.scores.clickbait}%\n\n?쒓났 ?쒕퉬??\n- ?먮쭑 ?꾨Ц/?붿빟\n- 遺꾩꽍蹂닿퀬 (?뺥솗?깃낵 ?닿렇濡쒖꽦 ?좊ː???먯닔 諛??됯?)\n- 梨꾨꼸 ?쒖쐞\n\n?곕━媛議??ш린濡쒖슫 ?좏뒠釉??앺솢 ?슗\n\n${window.location.href}`,
      url: window.location.href,
    }
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        const textToCopy = `${shareData.title}\n\n${shareData.text}`
        await navigator.clipboard.writeText(textToCopy)
        alert("?뱥 留곹겕媛 ?대┰蹂대뱶??蹂듭궗?섏뿀?듬땲??")
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name !== "AbortError") {
          console.error("[v0] 怨듭쑀 以??ㅻ쪟:", err)
          alert("怨듭쑀 湲곕뒫???ъ슜?????놁뒿?덈떎. 釉뚮씪?곗? ?ㅼ젙???뺤씤?댁＜?몄슂.")
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

  const parseTimestamp = (text: string) => {
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
    const timestampRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/g;
    
    // 以꾨컮轅??⑥쐞濡?癒쇱? ?섎늿 ??鍮?以??쒓굅
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    return lines.map((line, lineIdx) => {
      const segments = line.split(timestampRegex);
      return (
        <div key={lineIdx} className="mb-2 last:mb-0 flex items-start gap-1">
          <div className="flex-1 flex flex-wrap items-center">
            {segments.map((segment, i) => {
              if (segment.match(timestampRegex)) {
                return (
                  <button
                    key={i}
                    onClick={() => handleTimestampClick(segment)}
                    className="inline-flex items-center gap-0.5 font-bold text-blue-600 hover:text-blue-800 hover:underline decoration-2 underline-offset-2 transition-colors mr-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    {segment}
                  </button>
                );
              }
              // ??꾩뒪?ы봽 ?ㅼ쓽 ???-)??怨듬갚??以묐났?섏? ?딅룄濡?泥섎━
              const cleanSegment = segment.replace(/^(\s*-\s*)+/, '- ').trim();
              if (!cleanSegment && i > 0) return null; // ??꾩뒪?ы봽 諛붾줈 ?ㅼ쓽 鍮??멸렇癒쇳듃 臾댁떆

              return <span key={i} className="text-gray-700 leading-relaxed">{segment}</span>;
            })}
          </div>
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
- 二쇱젣: ${analysisData.topic}
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
1. [梨꾨꼸紐??쒕ぉ/二쇱젣] ?붿빟
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

  if (loading) {
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
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-500 font-medium mb-2">?좑툘 ?ㅻ쪟 諛쒖깮</p>
            <p className="text-gray-600 mb-4">{error || "?곗씠?곕? 李얠쓣 ???놁뒿?덈떎."}</p>
            <Button onClick={() => router.push("/")}>?덉쑝濡??뚯븘媛湲?/Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} onLoginSuccess={handleLoginSuccess} />
      <main className="container px-4 pt-6 pb-24">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="bg-background pb-2 pt-2">
            <AnalysisHeader
              channelImage={analysisData.channelImage}
              channelName={analysisData.channelName}
              title={analysisData.videoTitle}
              videoUrl={analysisData.url}
              date={analysisData.date}
              onBack={handleBack}
              onChannelClick={() => router.push(`/p-ranking?category=${analysisData.officialCategoryId}`)}
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
              onToggle={(type) => setActiveSubtitle(activeSubtitle === type ? null : type)} 
            />
          </div>
          {activeSubtitle === "full" && (
            <div className="overflow-hidden rounded-3xl border-4 border-gray-300 bg-blue-50">
              <div className="max-h-[60vh] overflow-y-auto p-5">
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {renderTextWithTimestamps(analysisData.fullSubtitle)}
                </p>
              </div>
            </div>
          )}
          {activeSubtitle === "summary" && (
            <div className="overflow-hidden rounded-3xl border-4 border-blue-300 bg-blue-50">
              <div className="max-h-[60vh] overflow-y-auto p-5">
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {renderTextWithTimestamps(analysisData.summarySubtitle)}
                </p>
              </div>
            </div>
          )}
          <ScoreCard 
              accuracy={analysisData.scores.accuracy} 
              clickbait={analysisData.scores.clickbait} 
              trust={analysisData.scores.trust} 
              topic={getCategoryName(analysisData.officialCategoryId)}
              trafficLightImage={getTrafficLightImage(analysisData.scores.trust)}
            />
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
                {showMore ? '?묎린 ?? : '??蹂닿린 ??}
              </button>
            </div>
          </div>
          {analysisData.scores.clickbait >= 30 && (
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
            onClick={() => router.push(`/p-ranking?category=${analysisData.officialCategoryId}`)}
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
              <div className="text-right">
                <div className="text-xs font-bold text-indigo-600">
                  ?곸쐞 {analysisData.channelStats?.topPercentile || 0}%
                </div>
                <div className="text-[10px] text-gray-500">
                  ({analysisData.channelStats?.rank || '-'}??/ {analysisData.channelStats?.totalChannels || '-'}媛?
                </div>
              </div>
            </div>
            
            {/* Percentile Progress Bar */}
            <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-indigo-100 border border-indigo-200">
              <div 
                className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-1000"
                style={{ width: `${100 - (analysisData.channelStats?.topPercentile || 100)}%` }}
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
                  <span className="text-sm font-bold text-gray-800 truncate max-w-[120px]">
                    {analysisData.channelName}
                  </span>
                </div>
                <div className="flex gap-3">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">?뺥솗??/div>
                    <div className="text-sm font-bold text-purple-600">{analysisData.channelStats?.avgAccuracy || 0}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">?닿렇濡?/div>
                    <div className="text-sm font-bold text-pink-500">{analysisData.channelStats?.avgClickbait || 0}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">?좊ː??/div>
                    <div className="text-sm font-bold text-indigo-600">{analysisData.channelStats?.avgReliability || 0}</div>
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
                      <br />( )?띿뿉 8 ~ 18???섏씠瑜??ｊ퀬 '?대┃' ?섎㈃ ChatGPT媛 ?좎깮?섏씠 ?섏뼱, ?섏쓽
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
            <h3 className="mb-4 text-lg font-bold">{comments.length}媛쒖쓽 ?볤?</h3>
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold">C</div>
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
                  placeholder="?볤? 異붽?..."
                  className="w-full border-b-2 border-gray-300 bg-transparent px-1 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
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
                      <span className="text-xs text-gray-500">{comment.date} {comment.time}</span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.text}</p>
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
